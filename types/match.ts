export type MatchData = {
  id: string;
  setNumber: number;

  team1Player1Id: string; team1Player1Name: string;
  team1Player2Id: string; team1Player2Name: string;
  team2Player1Id: string; team2Player1Name: string;
  team2Player2Id: string; team2Player2Name: string;

  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;

  reportedById?: string | null;
  reportedByName?: string;
  confirmedById?: string | null;
  confirmedByName?: string;
  photoUrl?: string | null;

  // scheduling
  status: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
  proposedDate: string | null;
  acceptedDate: string | null;
  acceptedBy: string[];
  proposedById: string | null;

  group: {
    id: string;
    number: number;
    level: number; // corregido a number
    players: { id: string; name: string; position: number }[];
    round: {
      id: string;
      number: number;
      startDate: string;
      endDate: string;
      isClosed: boolean;
    };
  };

  round: {
    id: string;
    number: number;
    startDate: string;
    endDate: string;
    isClosed: boolean;
  };

  tournament: { id: string; title: string };
};
