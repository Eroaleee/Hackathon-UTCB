-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('pista_biciclete', 'parcare_biciclete', 'semaforizare', 'zona_30', 'zona_pietonala', 'coridor_verde', 'infrastructura_mixta');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectStage" ADD VALUE 'proiectare';
ALTER TYPE "ProjectStage" ADD VALUE 'simulare';
ALTER TYPE "ProjectStage" ADD VALUE 'testare';

-- AlterTable
ALTER TABLE "infrastructure_elements" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "connectedRouteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "geometry" JSONB,
ADD COLUMN     "projectType" "ProjectType" NOT NULL DEFAULT 'infrastructura_mixta',
ADD COLUMN     "proposalId" TEXT,
ADD COLUMN     "simulationResults" JSONB,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "workingHours" TEXT;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "geometry" JSONB;

-- AlterTable
ALTER TABLE "simulation_scenarios" ADD COLUMN     "changes" JSONB,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password" TEXT;

-- CreateTable
CREATE TABLE "transit_stops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,

    CONSTRAINT "transit_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transit_routes" (
    "id" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "longName" TEXT NOT NULL DEFAULT '',
    "type" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '',
    "agencyId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "transit_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transit_shapes" (
    "id" TEXT NOT NULL,
    "shapeId" TEXT NOT NULL,
    "routeId" TEXT,
    "geometry" JSONB NOT NULL,

    CONSTRAINT "transit_shapes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_nodes" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "road_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_segments" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "length" DOUBLE PRECISION NOT NULL,
    "roadType" TEXT NOT NULL DEFAULT 'car_only',
    "speedLimit" INTEGER NOT NULL DEFAULT 50,
    "trafficLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "safetyScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "geometry" JSONB,

    CONSTRAINT "road_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transit_stops_latitude_longitude_idx" ON "transit_stops"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "transit_shapes_shapeId_idx" ON "transit_shapes"("shapeId");

-- CreateIndex
CREATE INDEX "transit_shapes_routeId_idx" ON "transit_shapes"("routeId");

-- CreateIndex
CREATE INDEX "road_nodes_latitude_longitude_idx" ON "road_nodes"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "road_segments_fromNodeId_idx" ON "road_segments"("fromNodeId");

-- CreateIndex
CREATE INDEX "road_segments_toNodeId_idx" ON "road_segments"("toNodeId");

-- CreateIndex
CREATE INDEX "infrastructure_elements_projectId_idx" ON "infrastructure_elements"("projectId");

-- CreateIndex
CREATE INDEX "simulation_scenarios_projectId_idx" ON "simulation_scenarios"("projectId");

-- AddForeignKey
ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transit_shapes" ADD CONSTRAINT "transit_shapes_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transit_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
