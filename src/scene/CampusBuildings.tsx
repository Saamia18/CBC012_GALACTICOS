import React from 'react';
import { MOCK_BUILDINGS } from '../data/mock';
import { BuildingMesh } from './BuildingMesh';
import { BuildingUsageStats } from '../utils/usageHeatmap';

interface CampusBuildingsProps {
  heatmapEnabled?: boolean;
  buildingUsage?: Record<string, BuildingUsageStats>;
  usageMax?: number;
}

export const CampusBuildings: React.FC<CampusBuildingsProps> = ({ heatmapEnabled = false, buildingUsage = {}, usageMax = 1 }) => {
  return (
    <group>
      {MOCK_BUILDINGS.map((building) => (
        <BuildingMesh
          key={building.id}
          building={building}
          heatmapEnabled={heatmapEnabled}
          usage={buildingUsage[building.id]}
          usageMax={usageMax}
        />
      ))}
    </group>
  );
};
