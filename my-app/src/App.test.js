import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AlgebraAssess hero', () => {
  render(<App />);
  const heroTitle = screen.getByText(/Intelligent Grading for/i);
  expect(heroTitle).toBeInTheDocument();
});
