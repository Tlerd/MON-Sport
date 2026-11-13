-- Brief F-029: player skill level on User (chosen at web sign-up)
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
ALTER TABLE "User" ADD COLUMN "skillLevel" "SkillLevel";
