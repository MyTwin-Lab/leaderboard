/**
 * Provider de workspace « branche GitHub » : crée la branche d'un challenge ou
 * la branche perso d'un contributeur, et la protège pour ses seuls membres.
 *
 * Installé par la distribution serveur, derrière l'interface
 * `WorkspaceProvider` du provisioner.
 */
export { GitHubBranchProvider } from "./provider.js";
