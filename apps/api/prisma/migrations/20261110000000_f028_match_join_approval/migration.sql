-- Brief F-028 (W1, BR-49 to BR-52): waiting list and host approval. Expand only.
CREATE TYPE "JoinMode" AS ENUM ('INSTANT', 'APPROVAL');
ALTER TABLE "Match" ADD COLUMN "joinMode" "JoinMode" NOT NULL DEFAULT 'INSTANT';
ALTER TYPE "MatchPlayerStatus" ADD VALUE 'PENDING';
ALTER TYPE "MatchPlayerStatus" ADD VALUE 'REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_JOIN_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_JOIN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'MATCH_JOIN_REJECTED';
