import { render } from '@testing-library/react-native';
import { Icon } from '../../../src/components/common/Icon';

describe('new icons', () => {
  const newIcons = ['menu', 'model', 'phone', 'copy', 'like', 'regenerate',
    'share', 'flash', 'cube', 'globe', 'lawyer', 'fire', 'phd',
    'chevUp', 'search', 'file', 'star', 'chart', 'help', 'info'] as const;

  newIcons.forEach(name => {
    it(`renders ${name} without error`, () => {
      const { getByTestId } = render(
        <Icon name={name} color="#000" testID={`icon-${name}`} />
      );
      expect(getByTestId(`icon-${name}`)).toBeTruthy();
    });
  });
});
