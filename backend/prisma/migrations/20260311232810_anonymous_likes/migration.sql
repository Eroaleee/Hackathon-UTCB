-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "anonymousLikes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "anonymousVoteScore" INTEGER NOT NULL DEFAULT 0;
