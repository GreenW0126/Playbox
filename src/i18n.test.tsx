import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { localizeNode, translateText } from './i18n';

describe('Playbox public localization', () => {
  it('translates core interface copy into Mandarin', () => {
    expect(translateText('SET A DURATION', 'zh')).toBe('设定时长');
    expect(translateText('Choose how long you want to stay with it.', 'zh')).toBe('选择你要投入多长时间。');
    expect(translateText('15 min remaining', 'zh')).toBe('剩余 15 分钟');
  });

  it('keeps English copy unchanged', () => {
    expect(translateText('SET A DURATION', 'en')).toBe('SET A DURATION');
  });

  it('localizes visible text and form values without changing event handlers', () => {
    const onClick = () => undefined;
    const localized = localizeNode(<button onClick={onClick} value="Strength">Continue</button>, 'zh');
    expect(isValidElement(localized)).toBe(true);
    if (!isValidElement<Record<string, unknown>>(localized)) return;
    expect(localized.props.children).toBe('下一步');
    expect(localized.props.value).toBe('力量训练');
    expect(localized.props.onClick).toBe(onClick);
  });
});
