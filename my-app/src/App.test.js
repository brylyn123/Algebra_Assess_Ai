import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AlgebraAssess hero', () => {
  render(<App />);
  const heroTitle = screen.getByText(/Intelligent Grading/i);
  expect(heroTitle).toBeInTheDocument();
});
