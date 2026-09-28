/**
 * Distribution MyTwin — règles des flows côté client
 * --------------------------------------------------
 * Le simulateur des règles ML, lu par l'éditeur de règles de l'admin. Calcul
 * pur, sans accès serveur. La vue des règles deviendra un slot du flow ML
 * (challenge 020, lot L4) ; d'ici là, le shell y accède par la distribution.
 */
export { simulateMaxDistribution } from '../../../../content/flows/ml/reward';
