import React from 'react';
import { Package } from 'lucide-react';
import { MOCK_EQUIPMENT } from '../data/mock';
import { EquipmentCategory, ResourceUnit } from '../types/scheduling';

type TileSize = 'xs' | 'sm' | 'md' | 'lg';

interface EquipmentIconTileProps {
  equipmentId?: string;
  category?: EquipmentCategory;
  name?: string;
  status?: ResourceUnit['status'] | 'confirmed' | 'pending' | 'cancelled' | 'maintenance' | 'in-use' | 'checked-in' | 'checked-out';
  selected?: boolean;
  size?: TileSize;
  className?: string;
}

const sizeClass: Record<TileSize, string> = {
  xs: 'h-6 w-6 rounded-md',
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-14 w-14 rounded-xl',
};

const iconSizeClass: Record<TileSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
};

const toneForStatus = (status?: EquipmentIconTileProps['status']) => {
  if (status === 'available' || status === 'confirmed' || status === 'checked-in') return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-500';
  if (status === 'booked' || status === 'in-use' || status === 'pending') return 'border-cyan-400/35 bg-cyan-500/10 text-cyan-500';
  if (status === 'maintenance' || status === 'cancelled') return 'border-rose-400/35 bg-rose-500/10 text-rose-500';
  return 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)]';
};

export const EquipmentIconTile: React.FC<EquipmentIconTileProps> = ({
  equipmentId,
  category,
  name,
  status,
  selected = false,
  size = 'md',
  className = '',
}) => {
  const unit = equipmentId ? MOCK_EQUIPMENT[equipmentId] : undefined;
  const label = name || unit?.name || category || 'Equipment';
  const iconUrl = unit?.iconUrl;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border transition ${sizeClass[size]} ${toneForStatus(status)} ${
        selected ? 'ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[var(--page-bg)]' : ''
      } ${className}`}
      title={label}
      aria-label={label}
      role="img"
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" className={`${iconSizeClass[size]} object-contain drop-shadow-sm`} />
      ) : (
        <Package className={iconSizeClass[size]} aria-hidden="true" />
      )}
    </span>
  );
};
