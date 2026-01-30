# Contributing to Case Management App

Thank you for your interest in contributing to the Case Management App! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Expected Behavior

- Be respectful of differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Development Environment Set Up**:
   - Node.js v16+
   - npm or yarn
   - Expo CLI
   - Git

2. **Fork and Clone**:
   ```bash
   # Fork the repository on GitHub

   # Clone your fork
   git clone https://github.com/YOUR_USERNAME/case-management-app.git
   cd case-management-app

   # Add upstream remote
   git remote add upstream https://github.com/original-org/case-management-app.git
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   cd frontend && npm install
   ```

4. **Set Up Environment**:
   ```bash
   cp frontend/.env.example frontend/.env
   # Edit .env with your configuration
   ```

---

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
# Update your local main branch
git checkout main
git pull upstream main

# Create a new feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Conventions

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Build process or tooling changes

Examples:
- `feature/add-appointment-reminders`
- `fix/location-search-crash`
- `docs/update-api-documentation`

### 2. Make Your Changes

- Write clean, readable code
- Follow the coding standards (see below)
- Add comments for complex logic
- Update documentation as needed
- Write or update tests

### 3. Test Your Changes

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Run tests
npm test

# Test on device/simulator
npm start
# Then press 'i' for iOS or 'a' for Android
```

### 4. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat: Add appointment reminder feature"
```

See [Commit Guidelines](#commit-guidelines) for commit message format.

### 5. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Then create a Pull Request on GitHub
```

---

## Coding Standards

### JavaScript/React Native Style

We follow the **Airbnb JavaScript Style Guide** with some modifications:

#### General Rules

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Line Length**: Maximum 100 characters
- **Trailing Commas**: Required in multi-line objects/arrays

#### Naming Conventions

```javascript
// Components: PascalCase
UserProfile.js
AppointmentCard.js

// Functions and variables: camelCase
const fetchUserData = () => {};
let appointmentCount = 0;

// Constants: UPPER_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_ATTEMPTS = 3;

// Private functions: prefix with underscore
const _helperFunction = () => {};

// Boolean variables: prefix with is/has/can
const isLoading = true;
const hasError = false;
const canSubmit = false;
```

#### File Structure

```javascript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// 2. Constants
const MAX_ITEMS = 10;

// 3. Helper functions
const formatDate = (date) => {
  // ...
};

// 4. Component
export default function MyComponent({ prop1, prop2 }) {
  // 4a. Hooks
  const [state, setState] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    // ...
  }, []);

  // 4b. Event handlers
  const handlePress = () => {
    // ...
  };

  // 4c. Render
  return (
    <View>
      <Text>Content</Text>
    </View>
  );
}

// 5. Styles (if using StyleSheet)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

#### React Best Practices

```javascript
// ✅ Good: Destructure props
export default function UserCard({ name, email, onPress }) {
  return <TouchableOpacity onPress={onPress}>...</TouchableOpacity>;
}

// ❌ Bad: Using props directly
export default function UserCard(props) {
  return <TouchableOpacity onPress={props.onPress}>...</TouchableOpacity>;
}

// ✅ Good: Use functional components with hooks
const [count, setCount] = useState(0);

// ❌ Bad: Class components (unless necessary)
class MyComponent extends React.Component { ... }

// ✅ Good: Meaningful variable names
const isUserLoggedIn = await checkAuthentication();

// ❌ Bad: Unclear names
const temp = await checkAuthentication();
const x = true;
```

### API Integration Standards

When adding API integrations, follow this pattern:

```javascript
// services/myService.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL, APP_SECRET } from '../config/constants';

/**
 * Fetches user data from the API
 *
 * @param {string} userId - The user's unique identifier
 * @returns {Promise<Object>} User data object
 * @throws {Error} If the API request fails
 *
 * @example
 * const userData = await fetchUserData('12345');
 * console.log(userData.name);
 */
export async function fetchUserData(userId) {
  try {
    // Validate input
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get auth token
    const token = await AsyncStorage.getItem('authToken');

    // Log request (for debugging)
    console.log('═══════════════════════════════════════');
    console.log('👤 FETCH USER DATA API REQUEST');
    console.log('═══════════════════════════════════════');
    console.log('User ID:', userId);
    console.log('Endpoint:', `${BASE_API_URL}/users/${userId}`);
    console.log('═══════════════════════════════════════');

    // Make API request
    const response = await axios.get(
      `${BASE_API_URL}/users/${userId}`,
      {
        headers: {
          'Accept': 'application/json',
          'AppSecret': APP_SECRET,
          ...(token && { 'Token': token }),
        },
        timeout: 30000,
      }
    );

    // Log response
    console.log('═══════════════════════════════════════');
    console.log('👤 FETCH USER DATA API RESPONSE');
    console.log('═══════════════════════════════════════');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('═══════════════════════════════════════');

    // Handle response
    const { data } = response;

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch user data');
    }

    return data.result;

  } catch (error) {
    console.error('❌ Error fetching user data:', error);

    // Provide helpful error messages
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 404) {
        throw new Error('User not found.');
      } else {
        throw new Error(`Failed to fetch user data: ${message}`);
      }
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.');
    } else {
      throw new Error(error.message || 'Failed to fetch user data');
    }
  }
}
```

### Documentation Standards

Every function should have JSDoc comments:

```javascript
/**
 * Brief description of what the function does
 *
 * More detailed description if needed. Explain:
 * - What the function accomplishes
 * - Any side effects
 * - Important implementation details
 *
 * @param {type} paramName - Description of parameter
 * @param {type} [optionalParam] - Description (optional parameter)
 * @returns {type} Description of return value
 * @throws {Error} Description of when errors are thrown
 *
 * @example
 * const result = myFunction('input');
 * console.log(result);
 */
```

---

## Commit Guidelines

We follow the **Conventional Commits** specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring (no functional changes)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process, tooling, dependencies

### Examples

```bash
# Feature
feat(appointment): Add reminder notification feature

# Bug fix
fix(login): Resolve token expiration issue

# Documentation
docs(readme): Update API documentation section

# Refactoring
refactor(auth): Simplify authentication flow

# Multiple changes
feat(booking): Add multi-step appointment flow

- Add provider selection step
- Add location selection step
- Add time slot selection step
- Integrate with referral API
```

### Commit Message Rules

1. **Subject line**:
   - Use imperative mood ("Add feature" not "Added feature")
   - Don't capitalize first letter
   - No period at the end
   - Maximum 72 characters

2. **Body** (optional):
   - Wrap at 72 characters
   - Explain what and why, not how
   - Separate from subject with blank line

3. **Footer** (optional):
   - Reference issues: `Closes #123`
   - Note breaking changes: `BREAKING CHANGE: ...`

---

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass**:
   ```bash
   npm test
   npm run lint
   ```

2. **Update documentation**:
   - Update README.md if needed
   - Add JSDoc comments to new functions
   - Update API documentation

3. **Test manually**:
   - Test on iOS simulator/device
   - Test on Android emulator/device
   - Test edge cases and error scenarios

### PR Title

Use the same format as commit messages:
```
feat(scope): Brief description of changes
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing Done
- [ ] Tested on iOS
- [ ] Tested on Android
- [ ] Added/updated tests
- [ ] Verified no existing functionality is broken

## Screenshots (if applicable)
[Add screenshots or GIFs showing the changes]

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs linting and tests
2. **Code Review**: At least one approval required
3. **Address Feedback**: Respond to all review comments
4. **Update as Needed**: Make requested changes
5. **Final Approval**: Maintainer approves and merges

### After Merge

1. Delete your feature branch
2. Update your local main branch:
   ```bash
   git checkout main
   git pull upstream main
   ```

---

## Testing Guidelines

### Unit Tests

Write unit tests for:
- Utility functions
- Service functions
- Complex business logic

```javascript
// __tests__/utils/dateUtils.test.js

import { formatDate } from '../utils/dateUtils';

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2026-01-15');
    expect(formatDate(date)).toBe('01/15/2026');
  });

  it('handles invalid dates', () => {
    expect(formatDate(null)).toBe('');
  });
});
```

### Integration Tests

Test API service functions:

```javascript
// __tests__/services/authService.test.js

import { login } from '../services/authService';

jest.mock('axios');

describe('authService', () => {
  it('logs in successfully', async () => {
    const mockResponse = {
      data: { success: true, token: 'abc123' }
    };
    axios.post.mockResolvedValue(mockResponse);

    const result = await login('user', 'pass');
    expect(result.token).toBe('abc123');
  });
});
```

### Component Tests

Test React components:

```javascript
// __tests__/components/Button.test.js

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Button from '../components/Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button title="Click Me" />);
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPress} />
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

---

## Documentation

### Code Documentation

- **Add JSDoc comments** to all exported functions
- **Explain complex logic** with inline comments
- **Document API integrations** with request/response examples
- **Note any quirks or workarounds** in comments

### README Updates

Update README.md when:
- Adding new features
- Changing configuration
- Adding dependencies
- Updating environment variables
- Changing deployment process

### API Documentation

Document all API endpoints with:
- Endpoint URL
- HTTP method
- Parameters
- Headers
- Request body example
- Response example
- Error handling
- Usage example

---

## Questions or Need Help?

- **GitHub Issues**: [Create an issue](https://github.com/your-org/case-management-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/case-management-app/discussions)
- **Email**: dev-team@yourorganization.com

---

Thank you for contributing! 🎉
