/** 与全站 CSS token 共用配色；业务 option 仍可覆盖主题默认值。 */
export function chartTheme(element: HTMLElement, dark: boolean) {
  const styles = getComputedStyle(element);
  const token = (name: string) => styles.getPropertyValue(`--app-color-${name}`).trim();
  const text = token('text-secondary');
  const border = token('border-secondary');
  return {
    darkMode: dark,
    backgroundColor: 'transparent',
    color: [token('primary'), '#13c2c2', '#52c41a', '#faad14', '#9254de', '#ff7875'],
    textStyle: { color: text, fontFamily: styles.fontFamily },
    legend: { textStyle: { color: text }, inactiveColor: token('text-disabled') },
    categoryAxis: {
      axisLine: { lineStyle: { color: border } },
      axisTick: { show: false },
      axisLabel: { color: text },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: text },
      splitLine: { lineStyle: { color: border, type: 'dashed' } },
    },
    tooltip: {
      backgroundColor: token('elevated'),
      borderColor: token('border'),
      textStyle: { color: token('text') },
      extraCssText: 'border-radius: 8px;',
    },
  };
}
