// Impede que uma janela de console apareça junto do aplicativo no Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    musica_lib::run()
}
