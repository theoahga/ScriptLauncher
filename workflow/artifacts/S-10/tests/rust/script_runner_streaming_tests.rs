// Tests S-10 ajoutés dans core/src/script_runner.rs (section #[cfg(test)])
// Voir le fichier source pour le code complet.
//
// TC-S10-01 : kill_script sans process actif → Ok(()) sans panique
// TC-S10-02 : kill_script avec process actif → state remis à None
//
// Ces tests sont inline dans script_runner.rs, pas dans un fichier séparé,
// conformément aux conventions Rust du projet (#[cfg(test)] inline).
