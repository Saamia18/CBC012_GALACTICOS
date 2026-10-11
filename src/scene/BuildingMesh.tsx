import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Building, MOCK_EQUIPMENT } from '../data/mock';
import { useCampusStore } from '../store/campusStore';
import { BuildingUsageStats, heatColorFor } from '../utils/usageHeatmap';

interface BuildingMeshProps {
  building: Building;
  heatmapEnabled?: boolean;
  usage?: BuildingUsageStats;
  usageMax?: number;
}

type BoxPart = {
  key: string;
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
};

type WindowPane = {
  pos: [number, number, number];
  size: [number, number, number];
  lit: boolean;
};

export const BuildingMesh: React.FC<BuildingMeshProps> = ({ building, heatmapEnabled = false, usage, usageMax = 1 }) => {
  const [hovered, setHovered] = useState(false);
  const selectedBuildingId = useCampusStore((s) => s.selectedBuildingId);
  const matchingBuildingIds = useCampusStore((s) => s.matchingBuildingIds);
  const wireframeOnly = useCampusStore((s) => s.wireframeOnly);
  const selectBuilding = useCampusStore((s) => s.selectBuilding);

  const isSelected = selectedBuildingId === building.id;
  const isMatch = matchingBuildingIds.includes(building.id);
  const usageCount = usage?.count ?? 0;
  const usageHours = usage?.hours ?? 0;
  const usageIntensity = usage?.intensity ?? (usageMax > 0 ? usageCount / usageMax : 0);
  const heatColor = heatColorFor(usageIntensity);
  const hasHeatUsage = heatmapEnabled && isMatch && usageCount > 0 && usageIntensity > 0;
  const [w, h, d] = building.size;

  const statusColor = useMemo(() => {
    if (building.equipmentIds.length === 0) return building.neonColor;

    const units = building.equipmentIds.map((id) => MOCK_EQUIPMENT[id]).filter(Boolean);
    const hasMaintenance = units.some((unit) => unit.status === 'maintenance');
    const allBooked = units.length > 0 && units.every((unit) => unit.status === 'booked');
    const hasAvailable = units.some((unit) => unit.status === 'available');

    if (allBooked) return '#ef4444';
    if (hasMaintenance) return '#eab308';
    if (hasAvailable) return building.neonColor;
    return building.neonColor;
  }, [building]);

  const wallColor = useMemo(() => {
    if (!isMatch) return '#101827';
    if (hovered || isSelected) {
      switch (building.colorTheme) {
        case 'cyan':
          return '#17334a';
        case 'green':
          return '#173827';
        case 'orange':
          return '#442515';
        case 'dark-blue':
        default:
          return '#1c2b4d';
      }
    }

    switch (building.colorTheme) {
      case 'cyan':
        return '#10283d';
      case 'green':
        return '#102b20';
      case 'orange':
        return '#2d190f';
      case 'dark-blue':
      default:
        return '#121f35';
    }
  }, [building.colorTheme, hovered, isMatch, isSelected]);

  const windowGlow = useMemo(() => {
    if (!isMatch) return '#0369a1';
    switch (building.colorTheme) {
      case 'cyan':
        return '#38bdf8';
      case 'green':
        return '#4ade80';
      case 'orange':
        return '#fb923c';
      case 'dark-blue':
      default:
        return '#60a5fa';
    }
  }, [building.colorTheme, isMatch]);

  const solidOpacity = wireframeOnly ? 0.08 : isMatch ? 1 : 0.32;
  const accentOpacity = isMatch ? (hovered || isSelected ? 1 : 0.72) : 0.2;

  const windows = useMemo<WindowPane[]>(() => {
    const panes: WindowPane[] = [];
    const floors = 3;
    const frontCols = 5;
    const frontSpacing = (w * 0.78) / frontCols;
    const floorHeight = (h * 0.72) / floors;

    for (let floor = 0; floor < floors; floor += 1) {
      const y = h * 0.24 + floor * floorHeight;
      for (let col = 0; col < frontCols; col += 1) {
        if (floor === 0 && col === Math.floor(frontCols / 2)) continue;
        const x = -w * 0.39 + (col + 0.5) * frontSpacing;
        panes.push({
          pos: [x, y, d / 2 + 0.025],
          size: [frontSpacing * 0.62, floorHeight * 0.44, 0.04],
          lit: (floor + col) % 2 === 0 || floor === floors - 1,
        });
      }
    }

    const sideCols = 3;
    const sideSpacing = (d * 0.72) / sideCols;
    for (let floor = 0; floor < floors; floor += 1) {
      const y = h * 0.24 + floor * floorHeight;
      for (let col = 0; col < sideCols; col += 1) {
        const z = -d * 0.36 + (col + 0.5) * sideSpacing;
        panes.push({
          pos: [w / 2 + 0.025, y, z],
          size: [0.04, floorHeight * 0.44, sideSpacing * 0.62],
          lit: (floor + col) % 3 !== 0,
        });
      }
    }

    return panes;
  }, [d, h, w]);

  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [d, h, w]);

  const utilityParts = useMemo<BoxPart[]>(() => {
    const parts: BoxPart[] = [
      {
        key: 'base-plinth',
        pos: [0, 0.1, 0],
        size: [w + 0.55, 0.2, d + 0.55],
        color: '#080e18',
        metalness: 0.2,
        roughness: 0.85,
      },
      {
        key: 'roof-slab',
        pos: [0, h + 0.03, 0],
        size: [w - 0.25, 0.06, d - 0.25],
        color: '#070c14',
        roughness: 0.9,
      },
      {
        key: 'front-parapet',
        pos: [0, h + 0.15, d / 2 - 0.08],
        size: [w, 0.3, 0.16],
        color: wallColor,
      },
      {
        key: 'back-parapet',
        pos: [0, h + 0.15, -d / 2 + 0.08],
        size: [w, 0.3, 0.16],
        color: wallColor,
      },
      {
        key: 'left-parapet',
        pos: [-w / 2 + 0.08, h + 0.15, 0],
        size: [0.16, 0.3, d - 0.32],
        color: wallColor,
      },
      {
        key: 'right-parapet',
        pos: [w / 2 - 0.08, h + 0.15, 0],
        size: [0.16, 0.3, d - 0.32],
        color: wallColor,
      },
      {
        key: 'penthouse',
        pos: [-w * 0.2, h + 0.42, -d * 0.15],
        size: [w * 0.38, 0.7, d * 0.38],
        color: '#101827',
        metalness: 0.4,
        roughness: 0.6,
      },
      {
        key: 'penthouse-trim',
        pos: [-w * 0.2, h + 0.82, -d * 0.15],
        size: [w * 0.42, 0.07, d * 0.42],
        color: '#0369a1',
        emissive: statusColor,
        emissiveIntensity: 0.2,
      },
      {
        key: 'hvac-a',
        pos: [w * 0.22, h + 0.25, -d * 0.22],
        size: [0.8, 0.38, 0.65],
        color: '#1e293b',
        metalness: 0.7,
        roughness: 0.4,
      },
      {
        key: 'hvac-b',
        pos: [w * 0.22, h + 0.25, d * 0.2],
        size: [0.8, 0.38, 0.65],
        color: '#1e293b',
        metalness: 0.7,
        roughness: 0.4,
      },
    ];

    return parts;
  }, [d, h, statusColor, w, wallColor]);

  const heatwaveLayers = useMemo(() => {
    const radiusX = Math.max(2, w * (0.55 + usageIntensity * 0.12));
    const radiusZ = Math.max(2, d * (0.55 + usageIntensity * 0.12));
    const height = Math.max(2.6, h * (0.86 + usageIntensity * 0.38));
    const baseOpacity = 0.045 + usageIntensity * 0.055;

    return [
      {
        y: height * 0.34,
        scale: [radiusX * 0.88, height * 0.48, radiusZ * 0.88] as [number, number, number],
        opacity: baseOpacity * 0.8,
      },
      {
        y: height * 0.55,
        scale: [radiusX * 1.02, height * 0.52, radiusZ * 1.02] as [number, number, number],
        opacity: baseOpacity * 0.58,
      },
      {
        y: height * 0.76,
        scale: [radiusX * 1.18, height * 0.5, radiusZ * 1.18] as [number, number, number],
        opacity: baseOpacity * 0.38,
      },
    ];
  }, [d, h, usageIntensity, w]);

  const heatwaveRingRadius = Math.max(w, d) * (0.62 + usageIntensity * 0.14);

  const renderBoxPart = (part: BoxPart) => (
    <mesh key={part.key} position={part.pos} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial
        color={part.color}
        transparent={wireframeOnly || !isMatch}
        opacity={solidOpacity}
        roughness={part.roughness ?? 0.7}
        metalness={part.metalness ?? 0.25}
        emissive={part.emissive ?? '#000000'}
        emissiveIntensity={part.emissiveIntensity ?? 0}
      />
    </mesh>
  );

  return (
    <group
      position={building.position}
      rotation={building.rotation || [0, 0, 0]}
      onClick={(event) => {
        event.stopPropagation();
        selectBuilding(building.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {utilityParts.map(renderBoxPart)}

      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={wallColor}
          transparent={wireframeOnly || !isMatch}
          opacity={solidOpacity}
          roughness={0.64}
          metalness={0.26}
          emissive={isSelected ? statusColor : '#000000'}
          emissiveIntensity={isSelected ? 0.16 : 0}
        />
      </mesh>

      <lineSegments geometry={edgesGeo} position={[0, h / 2, 0]}>
        <lineBasicMaterial color={statusColor} transparent opacity={accentOpacity} linewidth={1.5} />
      </lineSegments>

      {windows.map((pane, index) => (
        <mesh key={`${building.id}-window-${index}`} position={pane.pos}>
          <boxGeometry args={pane.size} />
          <meshStandardMaterial
            color={pane.lit ? '#1e3a5f' : '#0a101d'}
            transparent={wireframeOnly || !isMatch}
            opacity={wireframeOnly ? 0.25 : isMatch ? 1 : 0.38}
            emissive={pane.lit ? windowGlow : '#000000'}
            emissiveIntensity={pane.lit && isMatch ? 0.72 : 0.1}
            roughness={0.22}
            metalness={0.5}
          />
        </mesh>
      ))}

      <group position={[0, h * 0.22, d / 2 + 0.2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w * 0.32, h * 0.44, 0.4]} />
          <meshStandardMaterial
            color="#0d1522"
            transparent={wireframeOnly || !isMatch}
            opacity={solidOpacity}
            roughness={0.7}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0, -h * 0.05, 0.21]}>
          <planeGeometry args={[w * 0.18, h * 0.32]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive={statusColor}
            emissiveIntensity={isMatch ? 0.62 : 0.16}
            transparent
            opacity={wireframeOnly ? 0.3 : 0.86}
            roughness={0.12}
          />
        </mesh>
        <mesh position={[0, h * 0.22, 0.22]} castShadow>
          <boxGeometry args={[w * 0.38, 0.08, 0.6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} transparent={wireframeOnly} opacity={wireframeOnly ? 0.18 : 1} />
        </mesh>
      </group>

      <group position={[0, 0.1, d / 2 + 0.55]}>
        {[0, 1, 2].map((step) => (
          <mesh key={step} receiveShadow position={[0, -step * 0.045, step * 0.22]}>
            <boxGeometry args={[w * (0.34 + step * 0.04), 0.12 - step * 0.02, 0.28]} />
            <meshStandardMaterial color={step === 0 ? '#1e293b' : step === 1 ? '#162235' : '#0f172a'} roughness={0.9} />
          </mesh>
        ))}
      </group>

      <group position={[-w * 0.32, h + 0.78, d * 0.28]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.05, 1.35, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} transparent={wireframeOnly} opacity={wireframeOnly ? 0.2 : 1} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[0.34, 0.035, 0.035]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <sphereGeometry args={[0.085, 10, 10]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>

      {building.architecturalType === 'classical-library' && (
        <group position={[0, h * 0.3, d / 2 + 0.35]}>
          {[-w * 0.2, -w * 0.1, 0, w * 0.1, w * 0.2].map((x, index) => (
            <mesh key={index} position={[x, 0, 0.18]} castShadow>
              <cylinderGeometry args={[0.09, 0.12, h * 0.58, 12]} />
              <meshStandardMaterial color="#d97706" roughness={0.42} metalness={0.28} transparent={wireframeOnly || !isMatch} opacity={solidOpacity} />
            </mesh>
          ))}
          <mesh position={[0, h * 0.32, 0.18]} castShadow>
            <boxGeometry args={[w * 0.48, 0.18, 0.45]} />
            <meshStandardMaterial color="#b45309" roughness={0.5} transparent={wireframeOnly || !isMatch} opacity={solidOpacity} />
          </mesh>
        </group>
      )}

      {building.architecturalType === 'science-wing' && (
        <group position={[w * 0.32, h * 0.4, d * 0.32]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[w * 0.45, h * 0.8, d * 0.45]} />
            <meshStandardMaterial color="#0f263d" roughness={0.65} metalness={0.25} transparent={wireframeOnly || !isMatch} opacity={solidOpacity} />
          </mesh>
          <mesh position={[0, h * 0.4 + 0.08, 0]}>
            <boxGeometry args={[w * 0.47, 0.16, d * 0.47]} />
            <meshStandardMaterial color="#0284c7" emissive="#00e5ff" emissiveIntensity={isMatch ? 0.2 : 0.04} transparent={wireframeOnly || !isMatch} opacity={solidOpacity} />
          </mesh>
        </group>
      )}

      {building.architecturalType === 'stepped-annex' && (
        <group position={[0, h + 0.35, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[w * 0.72, 0.65, d * 0.72]} />
            <meshStandardMaterial color="#1a2744" roughness={0.6} metalness={0.3} transparent={wireframeOnly || !isMatch} opacity={solidOpacity} />
          </mesh>
          <mesh position={[0, 0, d * 0.36 + 0.02]}>
            <boxGeometry args={[w * 0.6, 0.22, 0.04]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={isMatch ? 0.78 : 0.16} transparent opacity={wireframeOnly ? 0.28 : 1} />
          </mesh>
        </group>
      )}

      {building.architecturalType === 'cube-archive' && (
        <group position={[0, h + 0.24, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[w * 0.66, 0.48, d * 0.66]} />
            <meshStandardMaterial color="#4a2514" roughness={0.62} metalness={0.28} transparent={wireframeOnly || !isMatch} opacity={solidOpacity} />
          </mesh>
          <mesh position={[0, 0.28, d * 0.34]}>
            <boxGeometry args={[w * 0.48, 0.16, 0.04]} />
            <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={isMatch ? 0.52 : 0.12} transparent opacity={wireframeOnly ? 0.28 : 0.92} />
          </mesh>
        </group>
      )}

      {hasHeatUsage && (
        <group position={[0, 0.08, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, d / w, 1]}>
            <ringGeometry args={[heatwaveRingRadius * 0.68, heatwaveRingRadius * 1.18, 112]} />
            <meshBasicMaterial
              color={heatColor}
              transparent
              opacity={0.1 + usageIntensity * 0.08}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {heatwaveLayers.map((layer, index) => (
            <mesh key={index} position={[0, layer.y, 0]} scale={layer.scale}>
              <cylinderGeometry args={[1, 0.78, 1, 112, 1, true]} />
              <meshBasicMaterial
                color={heatColor}
                transparent
                opacity={layer.opacity}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <planeGeometry args={[w + 1.15, d + 1.15]} />
        <meshBasicMaterial
          color={hasHeatUsage ? heatColor : statusColor}
          transparent
          opacity={hasHeatUsage ? 0.12 : isMatch ? 0.08 : 0.01}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {hasHeatUsage && (hovered || isSelected) && (
        <Html position={[0, h + 1.7, 0]} center>
          <div className="pointer-events-none min-w-52 rounded-lg border border-cyan-400/30 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-neon-cyan backdrop-blur">
            <div className="font-semibold text-white">{building.name}</div>
            <div className="mt-1 text-slate-400">
              {usageCount} bookings · {usageHours.toFixed(1)} usage hours
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-800">
              <div className="h-full rounded-full" style={{ width: `${Math.max(4, usageIntensity * 100)}%`, background: heatColor }} />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
