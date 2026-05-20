import { challengeTeams } from "./challengeData";
import type { Team } from "../types";

export const mockTeams: Team[] = challengeTeams;

export const getTeamById = (teamId: string) => mockTeams.find((team) => team.id === teamId);
