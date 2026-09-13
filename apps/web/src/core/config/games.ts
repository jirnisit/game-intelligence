import type { Text } from "../types/text";
type Game = {
  id: string;
  name: Text;
  description: Text;
  logo: string;
};
// The home catalogue is maintained in the frontend, independent of API availability.
export const limitZeroBreakers: Game = {
  id: "limit-zero-breakers",
  name: { en: "Limit Zero Breakers", th: "Limit Zero Breakers" },
  description: {
    en: "Explore characters, skills and buffs. Find the right members for your team.",
    th: "สำรวจตัวละคร สกิล และบัฟ เพื่อเลือกสมาชิกที่เหมาะกับทีมของคุณ",
  },
  logo: "/limit-zero-breakers-logo.png",
};
export const games: readonly Game[] = [limitZeroBreakers];
