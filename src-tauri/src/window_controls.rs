// Hyprland deliberately has no conventional minimized-window state. Do not
// emulate it by hiding the window: Buzz has no tray-based restore lifecycle.
#[cfg(any(target_os = "linux", test))]
fn can_minimize(desktop: &str, hyprland_signature: &str) -> bool {
    !desktop
        .split(':')
        .any(|name| name.trim().eq_ignore_ascii_case("Hyprland"))
        && hyprland_signature.is_empty()
}

#[tauri::command]
pub(crate) fn window_can_minimize() -> bool {
    #[cfg(target_os = "linux")]
    {
        can_minimize(
            &std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default(),
            &std::env::var("HYPRLAND_INSTANCE_SIGNATURE").unwrap_or_default(),
        )
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::can_minimize;

    #[test]
    fn excludes_hyprland_without_disabling_other_desktops() {
        for (desktop, signature) in [
            ("Hyprland", ""),
            ("hyprland", ""),
            ("wlroots:Hyprland", ""),
            ("", "instance"),
        ] {
            assert!(!can_minimize(desktop, signature));
        }
        for desktop in ["", "GNOME", "KDE", "sway", "NotHyprland"] {
            assert!(can_minimize(desktop, ""));
        }
    }
}
