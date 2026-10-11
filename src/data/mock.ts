export type EquipmentStatus = 'available' | 'booked' | 'maintenance';

export interface Booking {
  id: string;
  unitId: string;
  userName: string;
  userRole: 'Student' | 'Faculty' | 'Researcher' | 'Lab Admin';
  startTime: string;
  endTime: string;
  purpose: string;
}

export interface WaitlistEntry {
  id: string;
  unitId: string;
  userName: string;
  userRole: string;
  priorityScore: number;
  requestedAt: string;
}

export interface EquipmentUnit {
  id: string;
  name: string;
  unitNumber: string; // e.g. "#04"
  type: 'camera' | 'gpu' | 'vr' | 'microscope' | 'printer' | 'projector' | 'labkit' | 'device';
  iconUrl: string;
  buildingId: string;
  buildingName: string;
  status: EquipmentStatus;
  statusText: string;
  currentBooking?: Booking;
  nextBooking?: {
    startTime: string;
    endTime: string;
    userName: string;
  };
  specs: {
    model: string;
    resolution?: string;
    vram?: string;
    features?: string;
  };
  aliases: string[];
}

export interface Building {
  id: string;
  name: string;
  code: string;
  category: 'science' | 'media' | 'library' | 'annex' | 'archive';
  colorTheme: 'cyan' | 'green' | 'orange' | 'dark-blue';
  neonColor: string;
  fillColor: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  architecturalType: 'science-wing' | 'stepped-annex' | 'media-hall' | 'classical-library' | 'cube-archive';
  equipmentIds: string[];
}

export const MOCK_BUILDINGS: Building[] = [
  {
    id: 'bldg-science',
    name: 'Blue Building — Science Wing',
    code: 'SW-01',
    category: 'science',
    colorTheme: 'cyan',
    neonColor: '#00e5ff',
    fillColor: '#0284c7',
    position: [-7.5, 0, -1.5],
    size: [7.2, 3.8, 7.2],
    architecturalType: 'science-wing',
    equipmentIds: ['eq-cam-01', 'eq-print-01', 'eq-labkit-01'],
  },
  {
    id: 'bldg-media-1',
    name: 'Green Building 1 — Media Lab A',
    code: 'Block A - Media Wing',
    category: 'media',
    colorTheme: 'green',
    neonColor: '#22c55e',
    fillColor: '#15803d',
    position: [4.5, 0, -4.5],
    size: [7.0, 3.8, 6.0],
    architecturalType: 'media-hall',
    equipmentIds: ['eq-cam-04', 'eq-gpu-01', 'eq-vr-01'],
  },
  {
    id: 'bldg-library',
    name: 'Orange Building — Main Library Locker',
    code: 'LIB-HUB',
    category: 'library',
    colorTheme: 'orange',
    neonColor: '#f97316',
    fillColor: '#c2410c',
    position: [6.5, 0, 6.0],
    size: [7.0, 4.4, 6.6],
    architecturalType: 'classical-library',
    equipmentIds: ['eq-cam-02', 'eq-proj-01', 'eq-device-01'],
  },
  {
    id: 'bldg-media-2',
    name: 'Green Building 2 — Media Lab B',
    code: 'Block B - Studio 2',
    category: 'media',
    colorTheme: 'green',
    neonColor: '#22c55e',
    fillColor: '#15803d',
    position: [0.5, 0, 8.0],
    size: [6.4, 3.6, 5.4],
    architecturalType: 'media-hall',
    equipmentIds: ['eq-vr-02', 'eq-micro-01'],
  },
  {
    id: 'bldg-media-3',
    name: 'Green Building 3 — Secondary Lab',
    code: 'Block B - Studio 1',
    category: 'media',
    colorTheme: 'green',
    neonColor: '#22c55e',
    fillColor: '#15803d',
    position: [-6.0, 0, 4.5],
    size: [6.2, 3.8, 5.2],
    architecturalType: 'media-hall',
    equipmentIds: ['eq-vr-03', 'eq-micro-02'],
  },
  {
    id: 'bldg-empty-blue',
    name: 'Empty Blue Building — no equipment',
    code: 'NA-02',
    category: 'annex',
    colorTheme: 'dark-blue',
    neonColor: '#0284c7',
    fillColor: '#0f172a',
    position: [-3.5, 0, -7.5],
    size: [6.0, 4.2, 5.5],
    architecturalType: 'stepped-annex',
    equipmentIds: [],
  },
  {
    id: 'bldg-empty-orange',
    name: 'Empty Orange Building — no equipment',
    code: 'EA-04',
    category: 'archive',
    colorTheme: 'orange',
    neonColor: '#ea580c',
    fillColor: '#7c2d12',
    position: [10.5, 0, 0.5],
    size: [5.8, 4.0, 5.2],
    architecturalType: 'cube-archive',
    equipmentIds: [],
  },
];

export const MOCK_EQUIPMENT: Record<string, EquipmentUnit> = {
  'eq-cam-01': {
    id: 'eq-cam-01',
    name: 'DSLR Camera',
    unitNumber: '#01',
    type: 'camera',
    iconUrl: '/assets/icons/camera.png',
    buildingId: 'bldg-science',
    buildingName: 'Blue Building — Science Wing',
    status: 'available',
    statusText: 'AVAILABLE until 04:00 PM today',
    nextBooking: {
      startTime: '04:00 PM',
      endTime: '07:00 PM',
      userName: 'Dr. Evelyn Reed',
    },
    specs: {
      model: 'Sony Alpha 7 IV Mirrorless',
      resolution: '33MP Full-Frame 4K60p',
      features: '24-70mm GM f/2.8 Lens kit included',
    },
    aliases: ['sony', 'dslr', 'camera', 'cam', 'photo', 'video', 'lens'],
  },
  'eq-print-01': {
    id: 'eq-print-01',
    name: '3D Printer',
    unitNumber: '#02',
    type: 'printer',
    iconUrl: '/assets/icons/printer.png',
    buildingId: 'bldg-science',
    buildingName: 'Blue Building — Science Wing',
    status: 'available',
    statusText: 'AVAILABLE until 06:00 PM today',
    nextBooking: {
      startTime: '06:30 PM',
      endTime: '11:00 PM',
      userName: 'Marcus Vance',
    },
    specs: {
      model: 'Bambu Lab X1-Carbon Combo',
      resolution: '50-micron high-speed print',
      features: 'Dual extruder, carbon fiber enclosure',
    },
    aliases: ['printer', '3d', 'print', 'bambu', 'fab', 'rapid', 'proto'],
  },
  'eq-cam-04': {
    id: 'eq-cam-04',
    name: 'DSLR Camera',
    unitNumber: '#04',
    type: 'camera',
    iconUrl: '/assets/icons/camera.png',
    buildingId: 'bldg-media-1',
    buildingName: 'Green Building 1 — Media Lab A',
    status: 'available',
    statusText: 'AVAILABLE until 12:00 PM today',
    nextBooking: {
      startTime: '12:00 PM',
      endTime: '3:00 PM',
      userName: 'Alex M.',
    },
    specs: {
      model: 'Canon EOS R5C Cinema',
      resolution: '45MP 8K Raw 60fps',
      features: 'Dual Pixel CMOS AF II, active cooling',
    },
    aliases: ['camera', 'dslr', 'cam', 'canon', 'media', 'photo', 'video', 'cinematography'],
  },
  'eq-gpu-01': {
    id: 'eq-gpu-01',
    name: 'GPU Cluster',
    unitNumber: '#08',
    type: 'gpu',
    iconUrl: '/assets/icons/gpu.png',
    buildingId: 'bldg-media-1',
    buildingName: 'Green Building 1 — Media Lab A',
    status: 'booked',
    statusText: 'IN USE until 05:30 PM today (Devin T.)',
    currentBooking: {
      id: 'bk-gpu-101',
      unitId: 'eq-gpu-01',
      userName: 'Devin T.',
      userRole: 'Researcher',
      startTime: '10:00 AM',
      endTime: '05:30 PM',
      purpose: 'Deep Learning Diffusion Model Benchmark',
    },
    specs: {
      model: 'NVIDIA RTX 4090 24GB Server Node',
      vram: '24GB GDDR6X',
      features: 'CUDA 12.4, PyTorch 2.6 cluster mount',
    },
    aliases: ['gpu', 'cuda', 'nvidia', 'rtx', 'compute', 'ai', 'cluster', 'training'],
  },
  'eq-vr-01': {
    id: 'eq-vr-01',
    name: 'VR Headset',
    unitNumber: '#03',
    type: 'vr',
    iconUrl: '/assets/icons/vr.png',
    buildingId: 'bldg-media-1',
    buildingName: 'Green Building 1 — Media Lab A',
    status: 'available',
    statusText: 'AVAILABLE until 02:00 PM today',
    nextBooking: {
      startTime: '02:00 PM',
      endTime: '04:30 PM',
      userName: 'Chloe Sanders',
    },
    specs: {
      model: 'Meta Quest Pro 256GB',
      resolution: '1800x1920 per eye',
      features: 'Eye and face tracking, spatial audio',
    },
    aliases: ['vr', 'meta', 'quest', 'headset', 'virtual reality', 'xr', 'ar'],
  },
  'eq-cam-02': {
    id: 'eq-cam-02',
    name: 'DSLR Camera',
    unitNumber: '#02',
    type: 'camera',
    iconUrl: '/assets/icons/camera.png',
    buildingId: 'bldg-library',
    buildingName: 'Orange Building — Main Library Locker',
    status: 'booked',
    statusText: 'IN USE until 03:00 PM today (Sarah K.)',
    currentBooking: {
      id: 'bk-cam-202',
      unitId: 'eq-cam-02',
      userName: 'Sarah K.',
      userRole: 'Student',
      startTime: '11:00 AM',
      endTime: '03:00 PM',
      purpose: 'Design Documentary Interview B-Roll',
    },
    specs: {
      model: 'Sony FX3 Cinema Line',
      resolution: '12.1MP Full-Frame 4K120p',
      features: 'Top XLR handle unit, cage accessories',
    },
    aliases: ['camera', 'dslr', 'cam', 'sony', 'library', 'locker'],
  },
  'eq-proj-01': {
    id: 'eq-proj-01',
    name: 'Laser Projector',
    unitNumber: '#01',
    type: 'projector',
    iconUrl: '/assets/icons/projector.png',
    buildingId: 'bldg-library',
    buildingName: 'Orange Building — Main Library Locker',
    status: 'available',
    statusText: 'AVAILABLE until 05:00 PM today',
    nextBooking: {
      startTime: '05:00 PM',
      endTime: '08:00 PM',
      userName: 'Robotics Club',
    },
    specs: {
      model: 'Epson Pro L1070U 4K Laser',
      resolution: '1920x1200 WUXGA 4K Enhancement',
      features: '7,000 Lumens, ultra-short throw lens',
    },
    aliases: ['projector', 'proj', 'laser', 'epson', 'display', 'screen', 'presentation'],
  },
  'eq-vr-02': {
    id: 'eq-vr-02',
    name: 'VR Headset',
    unitNumber: '#05',
    type: 'vr',
    iconUrl: '/assets/icons/vr.png',
    buildingId: 'bldg-media-2',
    buildingName: 'Green Building 2 — Media Lab B',
    status: 'available',
    statusText: 'AVAILABLE until 01:30 PM today',
    nextBooking: {
      startTime: '02:00 PM',
      endTime: '05:00 PM',
      userName: 'Daniel Zhang',
    },
    specs: {
      model: 'HTC Vive Focus 3 Industrial',
      resolution: '5K (2448x2448 per eye)',
      features: 'Swappable battery pack, tracking beacons',
    },
    aliases: ['vr', 'vive', 'htc', 'headset', 'virtual reality', 'xr'],
  },
  'eq-micro-01': {
    id: 'eq-micro-01',
    name: 'Microscope',
    unitNumber: '#01',
    type: 'microscope',
    iconUrl: '/assets/icons/microscope.png',
    buildingId: 'bldg-media-2',
    buildingName: 'Green Building 2 — Media Lab B',
    status: 'maintenance',
    statusText: 'MAINTENANCE - Lens Recalibration until tomorrow 10:00 AM',
    specs: {
      model: 'Keyence VHX-7000 Digital Microscope',
      resolution: '4K Ultra High Resolution (20x-6000x)',
      features: 'High-dynamic range 3D measurement',
    },
    aliases: ['microscope', 'micro', 'scope', 'keyence', 'optics', 'bio', 'lab'],
  },
  'eq-vr-03': {
    id: 'eq-vr-03',
    name: 'VR Headset',
    unitNumber: '#06',
    type: 'vr',
    iconUrl: '/assets/icons/vr.png',
    buildingId: 'bldg-media-3',
    buildingName: 'Green Building 3 — Secondary Lab',
    status: 'booked',
    statusText: 'IN USE until 04:15 PM today (Liam N.)',
    currentBooking: {
      id: 'bk-vr-303',
      unitId: 'eq-vr-03',
      userName: 'Liam N.',
      userRole: 'Faculty',
      startTime: '01:00 PM',
      endTime: '04:15 PM',
      purpose: 'Interactive Architecture Simulation',
    },
    specs: {
      model: 'Apple Vision Pro 512GB',
      resolution: 'Micro-OLED 23 million pixels',
      features: 'VisionOS Spatial Personas enabled',
    },
    aliases: ['vr', 'apple', 'vision pro', 'xr', 'spatial'],
  },
  'eq-micro-02': {
    id: 'eq-micro-02',
    name: 'Microscope',
    unitNumber: '#02',
    type: 'microscope',
    iconUrl: '/assets/icons/microscope.png',
    buildingId: 'bldg-media-3',
    buildingName: 'Green Building 3 — Secondary Lab',
    status: 'available',
    statusText: 'AVAILABLE until 06:00 PM today',
    nextBooking: {
      startTime: '06:00 PM',
      endTime: '09:00 PM',
      userName: 'Elena Rostova',
    },
    specs: {
      model: 'Leica DM6 B Automated Microscope',
      resolution: 'Fluorescence & Brightfield Multi-Channel',
      features: 'Motorized focus, high-speed camera',
    },
    aliases: ['microscope', 'micro', 'scope', 'leica', 'optics', 'bio', 'lab'],
  },
  'eq-labkit-01': {
    id: 'eq-labkit-01',
    name: 'Lab Kit',
    unitNumber: '#01',
    type: 'labkit',
    iconUrl: '/assets/icons/labkit.png',
    buildingId: 'bldg-science',
    buildingName: 'Blue Building — Science Wing',
    status: 'available',
    statusText: 'AVAILABLE until 05:30 PM today',
    nextBooking: {
      startTime: '05:30 PM',
      endTime: '08:00 PM',
      userName: 'Applied Physics Cohort',
    },
    specs: {
      model: 'Modular Sensor Lab Kit',
      features: 'Oscilloscope probe, Arduino bridge, calibration blocks',
    },
    aliases: ['lab kit', 'kit', 'sensors', 'physics', 'arduino', 'testing'],
  },
  'eq-device-01': {
    id: 'eq-device-01',
    name: 'Testing Device',
    unitNumber: '#01',
    type: 'device',
    iconUrl: '/assets/icons/device.png',
    buildingId: 'bldg-library',
    buildingName: 'Orange Building — Main Library Locker',
    status: 'available',
    statusText: 'AVAILABLE until 07:00 PM today',
    specs: {
      model: 'Fluke Networks DSX CableAnalyzer',
      features: 'Certification testing, diagnostics, exportable reports',
    },
    aliases: ['testing', 'device', 'analyzer', 'diagnostic', 'meter'],
  },
};
