export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Manrope"', '"Avenir Next"', 'Sukhumvit Set', 'sans-serif']
      },
      colors: {
        obsidian: '#101714',
        pine: '#183f32',
        moss: '#7da17b',
        brass: '#d6a04f',
        cream: '#fff4df',
        porcelain: '#f5f0e8',
        signal: '#78f0b1'
      },
      boxShadow: {
        premium: '0 30px 100px rgba(16, 23, 20, 0.25)',
        glow: '0 0 60px rgba(120, 240, 177, 0.28)'
      }
    }
  },
  plugins: []
};
