declare module 'jest-axe' {
  import { Result } from 'axe-core'
  
  interface AxeMatchers<R = unknown> {
    toHaveNoViolations(): R
  }

  declare global {
    namespace jest {
      interface Expect extends AxeMatchers {}
      interface Matchers<R> extends AxeMatchers<R> {}
      interface InverseAsymmetricMatchers extends AxeMatchers {}
    }
  }

  export function axe(element: Element | Document, options?: any): Promise<{
    violations: Result[]
  }>
  
  export const toHaveNoViolations: any
}
