use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::Duration;

const MAX_WINDOW_POSITIONS: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanionConfigState {
    pub enabled: bool,
    pub position: String,
    pub size: String,
    #[serde(default = "default_gif_pack", rename = "gifPack")]
    pub gif_pack: String,
    #[serde(default = "default_loop_style", rename = "loopStyle")]
    pub loop_style: String,
    #[serde(default = "default_speed")]
    pub speed: f32,
}

fn default_gif_pack() -> String {
    "default".to_string()
}

fn default_loop_style() -> String {
    "classic".to_string()
}

fn default_speed() -> f32 {
    1.0
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct CompanionUiPreferencesState {
    #[serde(default = "default_true")]
    pub always_on_top: bool,
    #[serde(default)]
    pub dim_when_idle: bool,
}

impl Default for CompanionUiPreferencesState {
    fn default() -> Self {
        Self {
            always_on_top: true,
            dim_when_idle: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompanionState {
    pub version: u32,
    #[serde(default)]
    pub sessions: Vec<SessionInfo>,
    #[serde(default)]
    pub config: Option<CompanionConfigState>,
    #[serde(default)]
    pub window_positions: BTreeMap<String, WindowPositionState>,
    #[serde(default)]
    pub ui_preferences: CompanionUiPreferencesState,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct WindowPositionState {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub cwd: String,
    #[serde(default)]
    pub active_agents: Vec<String>,
    #[serde(default)]
    pub active_agent: Option<String>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub pid: Option<u32>,
    #[serde(default)]
    pub config: Option<CompanionConfigState>,
}

pub fn state_file_path() -> PathBuf {
    let base = std::env::var("XDG_DATA_HOME")
        .ok()
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".local")
                .join("share")
        });
    base.join("opencode")
        .join("storage")
        .join("oh-my-opencode-slim")
        .join("companion-state.json")
}

pub fn read_state(path: &std::path::Path) -> CompanionState {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn write_ui_preferences(
    path: &std::path::Path,
    preferences: CompanionUiPreferencesState,
) -> std::io::Result<()> {
    let _lock = StateWriteLock::acquire(path)?;
    let mut state = read_state(path);
    state.ui_preferences = preferences;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!("json.{}.tmp", std::process::id()));
    let json = serde_json::to_string(&state).map_err(std::io::Error::other)?;
    std::fs::write(&tmp, json)?;
    std::fs::rename(tmp, path)?;
    Ok(())
}

pub fn write_project_window_position(
    path: &std::path::Path,
    project: &str,
    position: WindowPositionState,
) -> std::io::Result<()> {
    if project.trim().is_empty() || !position.x.is_finite() || !position.y.is_finite() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "invalid companion window position",
        ));
    }

    let _lock = StateWriteLock::acquire(path)?;
    let mut state = read_state(path);
    state.window_positions.insert(project.to_string(), position);
    prune_window_positions(&mut state.window_positions, project);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!("json.{}.tmp", std::process::id()));
    let json = serde_json::to_string(&state).map_err(std::io::Error::other)?;
    std::fs::write(&tmp, json)?;
    std::fs::rename(tmp, path)?;
    Ok(())
}

fn prune_window_positions(
    positions: &mut BTreeMap<String, WindowPositionState>,
    protected_project: &str,
) {
    while positions.len() > MAX_WINDOW_POSITIONS {
        let Some(key) = positions
            .keys()
            .find(|key| key.as_str() != protected_project)
            .cloned()
        else {
            break;
        };
        positions.remove(&key);
    }
}

struct StateWriteLock {
    path: PathBuf,
}

impl StateWriteLock {
    fn acquire(state_path: &std::path::Path) -> std::io::Result<Self> {
        let lock_path = state_path.with_extension("json.lock");
        for _ in 0..40 {
            match std::fs::create_dir(&lock_path) {
                Ok(()) => return Ok(Self { path: lock_path }),
                Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
                    std::thread::sleep(Duration::from_millis(25));
                }
                Err(err) => return Err(err),
            }
        }
        Err(std::io::Error::new(
            std::io::ErrorKind::WouldBlock,
            "timed out waiting for companion state lock",
        ))
    }
}

impl Drop for StateWriteLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir(&self.path);
    }
}

/// Starts a background thread that polls the state file for changes.
/// Returns a receiver that fires whenever the file content changes.
pub fn start_watcher(path: PathBuf) -> Receiver<()> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || poll_loop(path, tx));
    rx
}

fn poll_loop(path: PathBuf, tx: Sender<()>) {
    let mut last_mtime: Option<std::time::SystemTime> = None;
    loop {
        if let Ok(meta) = std::fs::metadata(&path) {
            if let Ok(mtime) = meta.modified() {
                if Some(mtime) != last_mtime {
                    last_mtime = Some(mtime);
                    if tx.send(()).is_err() {
                        return;
                    }
                }
            }
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}


#[cfg(test)]
mod tests {
    use super::{
        read_state, write_ui_preferences, CompanionUiPreferencesState, WindowPositionState,
    };
    use std::collections::BTreeMap;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_state_path(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir()
            .join(format!("omos-companion-state-{}-{label}-{nonce}", std::process::id()))
            .join("companion-state.json")
    }

    #[test]
    fn ui_preferences_default_to_existing_behavior() {
        let path = temp_state_path("defaults");
        let state = read_state(&path);
        assert!(state.ui_preferences.always_on_top);
        assert!(!state.ui_preferences.dim_when_idle);
    }

    #[test]
    fn ui_preference_write_preserves_other_state() {
        let path = temp_state_path("preserve");
        let parent = path.parent().unwrap();
        std::fs::create_dir_all(parent).unwrap();

        let mut positions = BTreeMap::new();
        positions.insert(
            "project".to_string(),
            WindowPositionState { x: 42.0, y: 84.0 },
        );
        let initial = serde_json::json!({
            "version": 1,
            "sessions": [],
            "window_positions": positions,
        });
        std::fs::write(&path, serde_json::to_vec(&initial).unwrap()).unwrap();

        write_ui_preferences(
            &path,
            CompanionUiPreferencesState {
                always_on_top: false,
                dim_when_idle: true,
            },
        )
        .unwrap();

        let state = read_state(&path);
        assert!(!state.ui_preferences.always_on_top);
        assert!(state.ui_preferences.dim_when_idle);
        assert_eq!(
            state.window_positions.get("project"),
            Some(&WindowPositionState { x: 42.0, y: 84.0 })
        );

        let _ = std::fs::remove_dir_all(parent);
    }
}
