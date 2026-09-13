import type { Text } from "../../../core/types/text";
export type Team = {
  game_id: string;
  id: string;
  name: Text;
  description: Text;
  game_name: Text;
  characters: { id: string; name: Text }[];
};
