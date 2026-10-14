import axe from 'axe-core'

/**
 * Runs axe-core's WCAG 2.0–2.2 A/AA rules on a rendered element and returns readable violations.
 * jsdom has no layout, so color contrast cannot be computed here; it is checked in the browser instead.
 * Passing this does not mean the UI is WCAG compliant: keyboard and screen reader behavior need manual checks.
 */
export async function axeViolations(element: Element): Promise<string[]> {
  const results = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
  )
}
