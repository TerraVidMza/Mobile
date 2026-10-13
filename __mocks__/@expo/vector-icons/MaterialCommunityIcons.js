const React = require('react');

const MockIcon = (props) => React.createElement('span', props, props.name || '');
MockIcon.displayName = 'MaterialCommunityIcons';

module.exports = MockIcon;
module.exports.default = MockIcon;
