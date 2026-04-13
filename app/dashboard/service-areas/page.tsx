'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, get, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Edit2, 
  ToggleLeft, 
  ToggleRight,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface LatLngPoint {
  latitude: number;
  longitude: number;
}

interface ServiceArea {
  id: string;
  name: string;
  description: string;
  polygon: LatLngPoint[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface GeofenceSettings {
  isGeofencingEnabled: boolean;
  serviceAreas: ServiceArea[];
  outsideAreaMessage: string;
  activeServiceAreas?: ServiceArea[];
  activeServiceAreaIds?: string[];
  updatedAt?: string;
}

const defaultServiceAreas: ServiceArea[] = [
  {
    id: 'hinigaran_city',
    name: 'Hinigaran Municipality',
    description: 'All 24 barangays of Hinigaran, Negros Occidental',
    polygon: [
      { latitude: 10.3500, longitude: 122.8000 },
      { latitude: 10.3500, longitude: 122.8800 },
      { latitude: 10.3200, longitude: 123.0000 },
      { latitude: 10.2500, longitude: 123.0000 },
      { latitude: 10.2000, longitude: 122.9500 },
      { latitude: 10.2000, longitude: 122.8500 },
      { latitude: 10.2200, longitude: 122.8000 },
    ],
    isEnabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'binalbagan_city',
    name: 'Binalbagan Municipality',
    description: 'All 16 barangays of Binalbagan, Negros Occidental (including Payao)',
    polygon: [
      { latitude: 10.2800, longitude: 122.7500 },
      { latitude: 10.2800, longitude: 122.8800 },
      { latitude: 10.2500, longitude: 123.0500 },
      { latitude: 10.1500, longitude: 123.0500 },
      { latitude: 10.0500, longitude: 123.0000 },
      { latitude: 10.0500, longitude: 122.8500 },
      { latitude: 10.1000, longitude: 122.7500 },
    ],
    isEnabled: true,
    createdAt: new Date().toISOString(),
  },
];

const defaultSettings: GeofenceSettings = {
  isGeofencingEnabled: true,
  serviceAreas: defaultServiceAreas,
  outsideAreaMessage: 'Service not available in your location.',
  updatedAt: new Date().toISOString(),
};

const normalizePoint = (point: any): LatLngPoint | null => {
  if (!point) return null;

  const latitudeRaw = point.latitude ?? point.lat;
  const longitudeRaw = point.longitude ?? point.lng;
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
};

const normalizeArea = (area: any, fallbackId: string): ServiceArea | null => {
  if (!area || typeof area !== 'object') return null;

  const polygonSource: any[] = Array.isArray(area.polygon) ? area.polygon : [];
  const polygon = polygonSource
    .map((point: any) => normalizePoint(point))
    .filter((point: LatLngPoint | null): point is LatLngPoint => point !== null);

  if (polygon.length < 3) return null;

  const id = String(area.id || fallbackId);
  const name = String(area.name || '').trim();
  if (!name) return null;

  const createdAt = typeof area.createdAt === 'string'
    ? area.createdAt
    : new Date().toISOString();

  return {
    id,
    name,
    description: String(area.description || ''),
    polygon,
    isEnabled: area.isEnabled !== false,
    createdAt,
    ...(typeof area.updatedAt === 'string' ? { updatedAt: area.updatedAt } : {}),
  };
};

const normalizeAreas = (source: any): ServiceArea[] => {
  if (!source) return [];

  if (Array.isArray(source)) {
    return source
      .map((area: any, index: number) => normalizeArea(area, `area_${index + 1}`))
      .filter((area): area is ServiceArea => area !== null);
  }

  if (typeof source === 'object') {
    return Object.entries(source)
      .map(([key, area]) => normalizeArea(area, key))
      .filter((area): area is ServiceArea => area !== null);
  }

  return [];
};

const buildPersistedSettings = (newSettings: GeofenceSettings) => {
  const serviceAreas = normalizeAreas(newSettings.serviceAreas);
  const activeServiceAreas = serviceAreas.filter((area) => area.isEnabled);
  const updatedAt = new Date().toISOString();

  return {
    isGeofencingEnabled: newSettings.isGeofencingEnabled,
    outsideAreaMessage: newSettings.outsideAreaMessage,
    serviceAreas,
    activeServiceAreas,
    activeServiceAreaIds: activeServiceAreas.map((area) => area.id),
    updatedAt,
  };
};

export default function ServiceAreasPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<GeofenceSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [editingMessage, setEditingMessage] = useState(false);
  const [tempMessage, setTempMessage] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [newArea, setNewArea] = useState<Partial<ServiceArea>>({
    name: '',
    description: '',
    polygon: [],
    isEnabled: true,
  });
  const [newPoint, setNewPoint] = useState({ latitude: '', longitude: '' });

  useEffect(() => {
    const adminUser = localStorage.getItem('adminUser');
    if (!adminUser) {
      router.push('/pasakay/login');
      return;
    }
    loadSettings();
  }, [router]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settingsRef = ref(database, 'settings/geofencing');
      const snapshot = await get(settingsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const serviceAreas = normalizeAreas(data.serviceAreas);
        const activeServiceAreas = normalizeAreas(data.activeServiceAreas);
        const loadedAreas = serviceAreas.length > 0
          ? serviceAreas
          : (activeServiceAreas.length > 0 ? activeServiceAreas : defaultServiceAreas);
        
        setSettings({
          isGeofencingEnabled: data.isGeofencingEnabled ?? true,
          serviceAreas: loadedAreas,
          outsideAreaMessage: data.outsideAreaMessage || 'Service not available in your location.',
          activeServiceAreas: loadedAreas.filter((area) => area.isEnabled),
          activeServiceAreaIds: loadedAreas.filter((area) => area.isEnabled).map((area) => area.id),
          updatedAt: data.updatedAt,
        });
      } else {
        // Initialize with defaults
        await saveSettings(defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: GeofenceSettings) => {
    setSaving(true);
    try {
      const settingsRef = ref(database, 'settings/geofencing');
      const payload = buildPersistedSettings(newSettings);
      await set(settingsRef, payload);
      setSettings(payload);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleGeofencing = async () => {
    const newSettings = {
      ...settings,
      isGeofencingEnabled: !settings.isGeofencingEnabled,
    };
    await saveSettings(newSettings);
  };

  const toggleServiceArea = async (areaId: string) => {
    const newAreas = settings.serviceAreas.map(area =>
      area.id === areaId ? { ...area, isEnabled: !area.isEnabled, updatedAt: new Date().toISOString() } : area
    );
    await saveSettings({ ...settings, serviceAreas: newAreas });
  };

  const deleteServiceArea = async (areaId: string) => {
    const area = settings.serviceAreas.find(a => a.id === areaId);
    if (!confirm(`Are you sure you want to delete "${area?.name}"?`)) return;
    
    const newAreas = settings.serviceAreas.filter(area => area.id !== areaId);
    await saveSettings({ ...settings, serviceAreas: newAreas });
  };

  const resetToDefaults = async () => {
    if (!confirm('Reset all service areas to default (Hinigaran and Binalbagan)?\n\nThis will remove any custom areas.')) return;
    await saveSettings(defaultSettings);
  };

  const saveOutsideMessage = async () => {
    if (tempMessage.trim() === '') return;
    await saveSettings({ ...settings, outsideAreaMessage: tempMessage.trim() });
    setEditingMessage(false);
  };

  const toggleExpanded = (areaId: string) => {
    const newExpanded = new Set(expandedAreas);
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId);
    } else {
      newExpanded.add(areaId);
    }
    setExpandedAreas(newExpanded);
  };

  const addPointToNewArea = () => {
    const lat = parseFloat(newPoint.latitude);
    const lng = parseFloat(newPoint.longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates');
      return;
    }
    if (lat < -90 || lat > 90) {
      alert('Latitude must be between -90 and 90');
      return;
    }
    if (lng < -180 || lng > 180) {
      alert('Longitude must be between -180 and 180');
      return;
    }
    
    setNewArea({
      ...newArea,
      polygon: [...(newArea.polygon || []), { latitude: lat, longitude: lng }],
    });
    setNewPoint({ latitude: '', longitude: '' });
  };

  const removePointFromNewArea = (index: number) => {
    setNewArea({
      ...newArea,
      polygon: newArea.polygon?.filter((_, i) => i !== index) || [],
    });
  };

  const handleAddArea = async () => {
    if (!newArea.name?.trim()) {
      alert('Please enter area name');
      return;
    }
    if ((newArea.polygon?.length || 0) < 3) {
      alert('Please add at least 3 polygon points');
      return;
    }
    
    const area: ServiceArea = {
      id: Date.now().toString(),
      name: newArea.name.trim(),
      description: newArea.description?.trim() || '',
      polygon: newArea.polygon || [],
      isEnabled: true,
      createdAt: new Date().toISOString(),
    };
    
    const newSettings = {
      ...settings,
      serviceAreas: [...settings.serviceAreas, area],
    };
    
    if (await saveSettings(newSettings)) {
      setShowAddModal(false);
      setNewArea({ name: '', description: '', polygon: [], isEnabled: true });
    }
  };

  const openEditModal = (area: ServiceArea) => {
    setEditingArea({ ...area, polygon: [...area.polygon] });
    setShowEditModal(true);
  };

  const addPointToEditArea = () => {
    const lat = parseFloat(newPoint.latitude);
    const lng = parseFloat(newPoint.longitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Please enter valid coordinates');
      return;
    }
    
    if (editingArea) {
      setEditingArea({
        ...editingArea,
        polygon: [...editingArea.polygon, { latitude: lat, longitude: lng }],
      });
    }
    setNewPoint({ latitude: '', longitude: '' });
  };

  const removePointFromEditArea = (index: number) => {
    if (editingArea) {
      setEditingArea({
        ...editingArea,
        polygon: editingArea.polygon.filter((_, i) => i !== index),
      });
    }
  };

  const handleEditArea = async () => {
    if (!editingArea) return;
    if (!editingArea.name?.trim()) {
      alert('Please enter area name');
      return;
    }
    if (editingArea.polygon.length < 3) {
      alert('Please add at least 3 polygon points');
      return;
    }
    
    const newAreas = settings.serviceAreas.map(area =>
      area.id === editingArea.id
        ? { ...editingArea, updatedAt: new Date().toISOString() }
        : area
    );
    
    if (await saveSettings({ ...settings, serviceAreas: newAreas })) {
      setShowEditModal(false);
      setEditingArea(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Service Areas</h1>
            <p className="text-gray-600">Manage geofencing and service area boundaries</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadSettings}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-gray-700 font-medium">Refresh</span>
            </button>
            <button
              onClick={resetToDefaults}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="font-medium">Reset to Defaults</span>
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <p className="text-blue-700">
              Define service areas where your app features will be available. Users outside these areas will see a restricted access message.
            </p>
          </div>
        </div>

        {/* Geofencing Toggle */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Enable Geofencing</h3>
              <p className="text-gray-600 text-sm mt-1">
                {settings.isGeofencingEnabled
                  ? 'Users outside service areas will be blocked'
                  : 'All users can access the app regardless of location'}
              </p>
            </div>
            <button
              onClick={toggleGeofencing}
              disabled={saving}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                settings.isGeofencingEnabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  settings.isGeofencingEnabled ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Outside Area Message */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Outside Area Message</h3>
          {editingMessage ? (
            <div className="flex space-x-3">
              <input
                type="text"
                value={tempMessage}
                onChange={(e) => setTempMessage(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                placeholder="Enter message for users outside service areas"
              />
              <button
                onClick={saveOutsideMessage}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => setEditingMessage(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-gray-700">{settings.outsideAreaMessage}</p>
              <button
                onClick={() => {
                  setTempMessage(settings.outsideAreaMessage);
                  setEditingMessage(true);
                }}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span className="font-medium">Edit</span>
              </button>
            </div>
          )}
        </div>

        {/* Service Areas Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            Service Areas ({settings.serviceAreas.length})
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Area</span>
          </button>
        </div>

        {/* Service Areas List */}
        {settings.serviceAreas.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-4">No service areas defined</p>
            <button
              onClick={resetToDefaults}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Initialize with default areas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {settings.serviceAreas.map((area) => (
              <div key={area.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpanded(area.id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${area.isEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <h4 className="font-semibold text-gray-800">{area.name}</h4>
                      <p className="text-sm text-gray-500">
                        {area.polygon.length} points
                        {area.description && ` • ${area.description}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      area.isEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {area.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {expandedAreas.has(area.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                {expandedAreas.has(area.id) && (
                  <div className="border-t p-4 bg-gray-50">
                    <h5 className="font-medium text-gray-700 mb-3">Polygon Coordinates:</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                      {area.polygon.map((point, idx) => (
                        <div key={idx} className="bg-white px-3 py-2 rounded border text-sm">
                          <span className="text-gray-500">{idx + 1}.</span>{' '}
                          <span className="font-mono text-gray-800">
                            {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleServiceArea(area.id);
                        }}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                          area.isEnabled
                            ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                            : 'bg-green-100 hover:bg-green-200 text-green-700'
                        }`}
                      >
                        {area.isEnabled ? (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            <span className="font-medium">Disable</span>
                          </>
                        ) : (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            <span className="font-medium">Enable</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(area);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="font-medium">Edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteServiceArea(area.id);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="font-medium">Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Area Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-800">Add Service Area</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area Name *</label>
                  <input
                    type="text"
                    value={newArea.name || ''}
                    onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                    placeholder="e.g., Hinigaran City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newArea.description || ''}
                    onChange={(e) => setNewArea({ ...newArea, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Polygon Points ({newArea.polygon?.length || 0}) - Min 3 required
                  </label>
                  {(newArea.polygon?.length || 0) > 0 && (
                    <div className="space-y-2 mb-3">
                      {newArea.polygon?.map((point, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                          <span className="text-sm font-mono text-gray-800">
                            {idx + 1}. {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                          </span>
                          <button
                            onClick={() => removePointFromNewArea(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newPoint.latitude}
                      onChange={(e) => setNewPoint({ ...newPoint, latitude: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                      placeholder="Latitude (e.g., 10.2667)"
                    />
                    <input
                      type="text"
                      value={newPoint.longitude}
                      onChange={(e) => setNewPoint({ ...newPoint, longitude: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                      placeholder="Longitude (e.g., 122.8500)"
                    />
                    <button
                      onClick={addPointToNewArea}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewArea({ name: '', description: '', polygon: [], isEnabled: true });
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddArea}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Area'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Area Modal */}
        {showEditModal && editingArea && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-800">Edit Service Area</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area Name *</label>
                  <input
                    type="text"
                    value={editingArea.name}
                    onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={editingArea.description}
                    onChange={(e) => setEditingArea({ ...editingArea, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Polygon Points ({editingArea.polygon.length}) - Min 3 required
                  </label>
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {editingArea.polygon.map((point, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                        <span className="text-sm font-mono text-gray-800">
                          {idx + 1}. {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                        </span>
                        <button
                          onClick={() => removePointFromEditArea(idx)}
                          disabled={editingArea.polygon.length <= 3}
                          className="text-red-500 hover:text-red-700 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newPoint.latitude}
                      onChange={(e) => setNewPoint({ ...newPoint, latitude: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                      placeholder="Latitude"
                    />
                    <input
                      type="text"
                      value={newPoint.longitude}
                      onChange={(e) => setNewPoint({ ...newPoint, longitude: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                      placeholder="Longitude"
                    />
                    <button
                      onClick={addPointToEditArea}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingArea(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditArea}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
