import { motion } from 'framer-motion';
import { memo } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { DEVICE_PRESETS, type DevicePreset } from '~/utils/devices';
import { selectedDeviceId, deviceOrientation } from '~/lib/stores/previews';

export const DeviceSelector = memo(() => {
  const currentDeviceId = useStore(selectedDeviceId);
  const orientation = useStore(deviceOrientation);

  const currentDevice = DEVICE_PRESETS.find((d) => d.id === currentDeviceId);
  const showRotation = currentDevice?.type !== 'desktop';

  const handleDeviceSelect = (deviceId: string) => {
    selectedDeviceId.set(deviceId);

    // reset orientation when switching devices
    if (deviceId === 'desktop') {
      deviceOrientation.set('portrait');
    }
  };

  const toggleOrientation = () => {
    deviceOrientation.set(orientation === 'portrait' ? 'landscape' : 'portrait');
  };

  return (
    <div className="flex items-center gap-2">
      {/* Device buttons */}
      <div className="flex items-center gap-0.5 bg-bolt-elements-background-depth-1 rounded-full p-1">
        {DEVICE_PRESETS.map((device) => (
          <DeviceButton
            key={device.id}
            device={device}
            selected={currentDeviceId === device.id}
            onSelect={() => handleDeviceSelect(device.id)}
          />
        ))}
      </div>

      {/* Rotation button */}
      {showRotation && (
        <button
          onClick={toggleOrientation}
          className={classNames(
            'flex items-center justify-center w-7 h-7 rounded-full transition-theme',
            'bg-bolt-elements-background-depth-1',
            'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
          )}
          title={orientation === 'portrait' ? 'Paysage' : 'Portrait'}
        >
          <span
            className={classNames('i-ph:device-rotate text-base transition-transform duration-200', {
              'rotate-90': orientation === 'landscape',
            })}
          />
        </button>
      )}
    </div>
  );
});

interface DeviceButtonProps {
  device: DevicePreset;
  selected: boolean;
  onSelect: () => void;
}

const DeviceButton = memo(({ device, selected, onSelect }: DeviceButtonProps) => {
  return (
    <button
      onClick={onSelect}
      className={classNames(
        'relative flex items-center justify-center w-7 h-7 rounded-full transition-theme',
        selected
          ? 'text-bolt-elements-item-contentAccent'
          : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
      )}
      title={device.name}
    >
      <span className={classNames(device.icon, 'text-base relative z-10')} />
      {selected && (
        <motion.span
          layoutId="device-selector-pill"
          transition={{ duration: 0.2, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 bg-bolt-elements-item-backgroundAccent rounded-full"
        />
      )}
    </button>
  );
});

DeviceSelector.displayName = 'DeviceSelector';
DeviceButton.displayName = 'DeviceButton';
