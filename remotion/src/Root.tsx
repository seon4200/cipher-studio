import { Composition } from 'remotion';
import { MainClip, defaultProps } from './MainClip';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainClip"
      component={MainClip}
      durationInFrames={300} // Up to 10 seconds at 30 fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
    />
  );
};
