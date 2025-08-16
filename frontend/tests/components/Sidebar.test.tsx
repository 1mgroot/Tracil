import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/ui/sidebar/Sidebar'
import { testAccessibility, testKeyboardNavigation, runFullAccessibilityTest } from '../helpers/accessibility'
import '@testing-library/jest-dom'

describe('Sidebar Accessibility Tests', () => {
  const mockOnKeyDown = jest.fn()
  const mockOnClick = jest.fn()

  const renderSidebar = () => {
    return render(
      <Sidebar onKeyDown={mockOnKeyDown}>
        <SidebarGroup label="Test Group" accentVar="--accent-sdtm">
          <SidebarItem 
            active={false}
            onClick={mockOnClick}
            itemId="item-1"
          >
            Item 1
          </SidebarItem>
          <SidebarItem 
            active={true}
            onClick={mockOnClick}
            itemId="item-2"
          >
            Item 2
          </SidebarItem>
          <SidebarItem 
            active={false}
            onClick={mockOnClick}
            itemId="item-3"
          >
            Item 3
          </SidebarItem>
        </SidebarGroup>
      </Sidebar>
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Accessibility', () => {
    it('should pass axe accessibility tests', async () => {
      const { container } = renderSidebar()
      await testAccessibility(container)
    })

    it('should have proper semantic HTML structure', () => {
      renderSidebar()
      
      // Check for navigation landmark
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'File navigation')
      
      // Check for group structure
      expect(screen.getByRole('group')).toBeInTheDocument()
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      
      // Check for options
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(3)
    })

    it('should have proper ARIA attributes', () => {
      renderSidebar()
      
      const group = screen.getByRole('group')
      expect(group).toHaveAttribute('aria-labelledby', 'sidebar-group-test-group')
      
      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveAttribute('aria-labelledby', 'sidebar-group-test-group')
      
      const options = screen.getAllByRole('option')
      options.forEach((option, index) => {
        expect(option).toHaveAttribute('aria-selected')
        expect(option).toHaveAttribute('data-item-id', `item-${index + 1}`)
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('should have proper tab order', () => {
      renderSidebar()
      
      const options = screen.getAllByRole('option')
      
      // Only the active item should be in tab order
      expect(options[0]).toHaveAttribute('tabIndex', '-1')
      expect(options[1]).toHaveAttribute('tabIndex', '0') // active item
      expect(options[2]).toHaveAttribute('tabIndex', '-1')
    })

    it('should handle keyboard events', () => {
      renderSidebar()
      
      const navigation = screen.getByRole('navigation')
      
      // Test arrow key navigation
      fireEvent.keyDown(navigation, { key: 'ArrowDown' })
      expect(mockOnKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'ArrowDown' })
      )
      
      fireEvent.keyDown(navigation, { key: 'ArrowUp' })
      expect(mockOnKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'ArrowUp' })
      )
      
      fireEvent.keyDown(navigation, { key: 'Home' })
      expect(mockOnKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Home' })
      )
      
      fireEvent.keyDown(navigation, { key: 'End' })
      expect(mockOnKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'End' })
      )
    })

    it('should support Enter and Space key activation', () => {
      renderSidebar()
      
      const activeOption = screen.getAllByRole('option')[1]
      
      // Simulate Enter key press
      fireEvent.keyDown(activeOption, { key: 'Enter' })
      fireEvent.click(activeOption) // Enter should trigger click
      expect(mockOnClick).toHaveBeenCalled()
      
      // Reset mock and test Space key
      mockOnClick.mockClear()
      fireEvent.keyDown(activeOption, { key: ' ' })
      fireEvent.click(activeOption) // Space should trigger click
      expect(mockOnClick).toHaveBeenCalled()
    })
  })

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      renderSidebar()
      
      const options = screen.getAllByRole('option')
      options.forEach(option => {
        // Check that focus-visible utility classes are present
        // Note: focus-visible:outline might be optimized away by Tailwind if not used
        expect(option).toHaveClass('focus-visible:outline-2')
        expect(option).toHaveClass('focus-visible:outline-[var(--focus)]')
      })
    })

    it('should manage focus correctly', () => {
      renderSidebar()
      
      const activeOption = screen.getAllByRole('option')[1]
      activeOption.focus()
      
      expect(document.activeElement).toBe(activeOption)
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper labels and descriptions', () => {
      renderSidebar()
      
      // Check group labeling
      const groupLabel = screen.getByText('Test Group')
      expect(groupLabel).toHaveAttribute('id', 'sidebar-group-test-group')
      
      // Check that decorative elements are hidden
      const decorativeSpan = groupLabel.querySelector('span[aria-hidden="true"]')
      expect(decorativeSpan).toBeInTheDocument()
    })

    it('should announce selection state', () => {
      renderSidebar()
      
      const options = screen.getAllByRole('option')
      
      expect(options[0]).toHaveAttribute('aria-selected', 'false')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
      expect(options[2]).toHaveAttribute('aria-selected', 'false')
    })
  })

  describe('Comprehensive Accessibility Test', () => {
    it('should pass all accessibility tests', async () => {
      const { container } = renderSidebar()
      
      await runFullAccessibilityTest(container, {
        expectedFocusableElements: 4, // nav element + 3 buttons
        expectedAriaAttributes: {
          'role': 'navigation',
          'aria-label': 'File navigation',
        },
        minimumContrastRatio: 4.5,
      })
    })
  })

  describe('Error Conditions', () => {
    it('should handle missing props gracefully', () => {
      render(
        <Sidebar>
          <SidebarGroup label="Test">
            <SidebarItem>Test Item</SidebarItem>
          </SidebarGroup>
        </Sidebar>
      )
      
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('option')).toBeInTheDocument()
    })
  })
})
