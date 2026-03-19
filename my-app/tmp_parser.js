const parser = require('@babel/parser');
parser.parse('<div virtual-keyboard-mode="manual"></div>', { sourceType: 'module', plugins: ['jsx'] });
console.log('ok');
