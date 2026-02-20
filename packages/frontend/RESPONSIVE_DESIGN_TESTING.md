# Responsive Design Testing Guide

This document provides a guide for testing the responsive design implementation across different device sizes.

## Testing Breakpoints

The application uses the following breakpoints:
- **Mobile (Small)**: 0-480px
- **Mobile (Medium)**: 481-768px
- **Tablet**: 769-1024px
- **Desktop**: 1025px+

## Key Features to Test

### 1. Hamburger Menu (Mobile Navigation)
**Breakpoint**: ≤768px

**Test Steps**:
1. Resize browser to mobile width (≤768px)
2. Verify hamburger menu button appears in top-left corner
3. Click hamburger button to open sidebar
4. Verify sidebar slides in from left with overlay
5. Click overlay or navigation item to close sidebar
6. Verify smooth animations

**Expected Behavior**:
- Hamburger menu visible only on mobile
- Sidebar hidden by default on mobile
- Sidebar slides in smoothly when opened
- Dark overlay appears behind sidebar
- Clicking overlay or nav item closes sidebar

### 2. Dashboard Page
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. Navigate to Dashboard
2. Check KPI cards layout
3. Verify analytics charts adapt to screen size
4. Test risk alerts display

**Expected Behavior**:
- KPI cards stack vertically on mobile
- Charts resize appropriately
- All content readable without horizontal scroll

### 3. Projects Page
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. Navigate to Projects page
2. Test search and filter controls
3. Switch between table and grid views
4. Test pagination controls

**Expected Behavior**:
- Search bar full width on mobile
- Filters stack vertically on mobile
- Table scrolls horizontally on mobile (min-width preserved)
- Grid view shows single column on mobile
- Buttons stack vertically on mobile

### 4. Project Detail Page
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. Open a project detail page
2. Check metadata grid layout
3. Verify team section and forecast section
4. Test task management section

**Expected Behavior**:
- Two-column grid becomes single column on mobile/tablet
- All sections stack vertically
- Action buttons stack vertically on mobile
- Forecast indicators adapt to full width

### 5. Task Management
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. View task list
2. Test task form
3. Test progress update component

**Expected Behavior**:
- Phase groups expand/collapse smoothly
- Task items stack content on mobile
- Progress bars adapt to full width
- Form fields stack vertically on mobile

### 6. Timeline/Gantt View
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. Navigate to Timeline page
2. Test view mode controls
3. Test zoom and pan interactions
4. Verify touch interactions on mobile

**Expected Behavior**:
- View mode buttons adapt to mobile
- Timeline scrolls horizontally on mobile
- Touch gestures work smoothly
- Minimum width maintained for readability

### 7. Document Management
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. Navigate to Documents page
2. Test document upload
3. View document list/grid
4. Test document actions

**Expected Behavior**:
- Upload drop zone adapts to mobile
- Document grid shows single column on mobile
- Action buttons stack vertically
- File selection works on mobile devices

### 8. User Management (Admin)
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. Navigate to Users page (as admin)
2. Test user table
3. Test create/edit user modal

**Expected Behavior**:
- Table scrolls horizontally on mobile
- Modal adapts to mobile screen
- Form fields stack vertically
- Action buttons stack vertically

### 9. Audit Logs (Admin)
**Test on**: Mobile, Tablet, Desktop

**Test Steps**:
1. Navigate to Audit Logs page
2. Test filters and search
3. View log details

**Expected Behavior**:
- Filters stack vertically on mobile
- Table scrolls horizontally
- Log details adapt to mobile width

## Touch-Friendly Interactions

### Minimum Touch Target Size
All interactive elements should have a minimum size of 44x44px on touch devices.

**Test Elements**:
- Buttons
- Links
- Form inputs
- Checkboxes/Radio buttons
- Select dropdowns

### Scrolling
- All scrollable areas should use smooth touch scrolling
- No horizontal scroll on main content (except tables)
- Vertical scroll should be smooth and responsive

## Browser Testing

Test on the following browsers:
- **Mobile**: Safari iOS, Chrome Android
- **Desktop**: Chrome, Firefox, Safari, Edge

## Device Testing

Recommended test devices:
- **iPhone SE** (375px width)
- **iPhone 12/13** (390px width)
- **iPad** (768px width)
- **iPad Pro** (1024px width)
- **Desktop** (1920px width)

## Chrome DevTools Testing

1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Select different device presets
4. Test in both portrait and landscape orientations
5. Use "Responsive" mode to test custom sizes

## Common Issues to Check

- [ ] No horizontal scrolling on mobile (except tables)
- [ ] All text is readable without zooming
- [ ] Buttons are large enough to tap easily
- [ ] Forms are easy to fill on mobile
- [ ] Images scale properly
- [ ] Navigation is accessible
- [ ] Content doesn't overflow containers
- [ ] Spacing is appropriate for screen size
- [ ] Font sizes are readable on small screens

## Accessibility Considerations

- [ ] Hamburger menu has proper aria-label
- [ ] Focus states visible on all interactive elements
- [ ] Color contrast meets WCAG standards
- [ ] Touch targets meet minimum size requirements
- [ ] Screen reader navigation works correctly

## Performance on Mobile

- [ ] Page loads quickly on 3G connection
- [ ] Animations are smooth (60fps)
- [ ] No layout shifts during load
- [ ] Images are optimized for mobile
- [ ] CSS and JS bundles are reasonably sized

## Notes

- The hamburger menu implementation uses CSS transitions for smooth animations
- The sidebar overlay prevents interaction with content when menu is open
- All responsive breakpoints use mobile-first approach
- Touch-friendly interactions are enabled via CSS media queries
