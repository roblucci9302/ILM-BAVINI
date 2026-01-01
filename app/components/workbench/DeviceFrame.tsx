import { motion } from 'framer-motion';
import { memo, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { DEVICE_PRESETS, getDeviceDimensions } from '~/utils/devices';
import { selectedDeviceId, deviceOrientation } from '~/lib/stores/previews';

interface DeviceFrameProps {
  children: ReactNode;
}

export const DeviceFrame = memo(({ children }: DeviceFrameProps) => {
  const currentDeviceId = useStore(selectedDeviceId);
  const orientation = useStore(deviceOrientation);

  const device = DEVICE_PRESETS.find((d) => d.id === currentDeviceId);

  if (!device) {
    return <div className="w-full h-full">{children}</div>;
  }

  // desktop mode: full width/height, no frame
  if (device.type === 'desktop') {
    return <div className="w-full h-full">{children}</div>;
  }

  const { width, height } = getDeviceDimensions(device, orientation);

  return (
    <div className="flex-1 flex items-center justify-center bg-bolt-elements-background-depth-3 overflow-hidden p-4">
      <motion.div
        layout="position"
        transition={{ duration: 0.3, ease: cubicEasingFn }}
        className={classNames('relative rounded-[40px] bg-gray-900 p-3 shadow-2xl', 'border-4 border-gray-800')}
      >
        {/* screen bezel */}
        <motion.div
          layout="size"
          transition={{ duration: 0.3, ease: cubicEasingFn }}
          className="rounded-[28px] overflow-hidden bg-white"
          style={{
            width: `${width}px`,
            height: `${height}px`,
          }}
        >
          {children}
        </motion.div>

        {/* home indicator (for mobile) */}
        {device.type === 'mobile' && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-700 rounded-full" />
        )}
      </motion.div>
    </div>
  );
});

DeviceFrame.displayName = 'DeviceFrame';
