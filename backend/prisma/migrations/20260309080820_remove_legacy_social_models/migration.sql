/*
  Warnings:

  - You are about to drop the `comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `follows` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `likes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `posts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_postId_fkey";

-- DropForeignKey
ALTER TABLE "follows" DROP CONSTRAINT "follows_followerId_fkey";

-- DropForeignKey
ALTER TABLE "follows" DROP CONSTRAINT "follows_followingId_fkey";

-- DropForeignKey
ALTER TABLE "likes" DROP CONSTRAINT "likes_postId_fkey";

-- DropForeignKey
ALTER TABLE "likes" DROP CONSTRAINT "likes_userId_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_authorId_fkey";

-- DropTable
DROP TABLE "comments";

-- DropTable
DROP TABLE "follows";

-- DropTable
DROP TABLE "likes";

-- DropTable
DROP TABLE "posts";
