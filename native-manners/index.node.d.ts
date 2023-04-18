/* File with types for ABI functions defined into index.node file (node native module) */

type UsersIdentifiersArray = string[];
type UsersCandidatesArray = string[];

/** Function which takes user from room data and return separated values for each user as his: identifier and candidate data */
export declare function split_candidates(candidatesList: string[]): [UsersIdentifiersArray, UsersCandidatesArray]