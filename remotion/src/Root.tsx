import { Composition } from 'remotion';
import { MainClip, defaultProps, MainClipProps } from './MainClip';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainClip"
      component={MainClip}
      fps={30}
      defaultProps={defaultProps as any}
      calculateMetadata={({ props }) => {
        const isVertical = (props as MainClipProps)?.aspectRatio === '9:16';
        return {
          width: isVertical ? 1080 : 1920,
          height: isVertical ? 1920 : 1080,
          durationInFrames: 90, // Fixed 3 seconds at 30fps
        };
      }}
    />
  );
};

