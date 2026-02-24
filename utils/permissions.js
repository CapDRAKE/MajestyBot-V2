const { PermissionsBitField } = require("discord.js");

function isStaff(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
         member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function hasPerm(member, permFlag) {
  return member && member.permissions.has(permFlag);
}

module.exports = { isStaff, hasPerm };