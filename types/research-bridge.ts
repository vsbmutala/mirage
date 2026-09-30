// Re-export hub so lib/ files can import domain types from one place.
export type { Person, StructuredProfile, IdentityStatus } from "./person";
export type { Candidate } from "./candidate";
export type { Evidence } from "./evidence";
export * from "./research";
