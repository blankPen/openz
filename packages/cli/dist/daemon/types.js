export const DEFAULT_PORT = 19999;
export function getDaemonStatePath() {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return `${home}/.uran/daemon.state.json`;
}
