const sequelize = require('../config/database');
const User = require('./User');
const Module = require('./Module');
const Lesson = require('./Lesson');
const Enrollment = require('./Enrollment');
const StudentLesson = require('./StudentLesson');

Module.belongsTo(User, { as: 'instructor', foreignKey: 'instructorId' });
User.hasMany(Module, { foreignKey: 'instructorId' });

Module.hasMany(Lesson, { foreignKey: 'moduleId', onDelete: 'CASCADE' });
Lesson.belongsTo(Module, { foreignKey: 'moduleId' });

User.belongsToMany(Module, { through: Enrollment, as: 'enrolledModules', foreignKey: 'userId' });
Module.belongsToMany(User, { through: Enrollment, as: 'students', foreignKey: 'moduleId' });
Enrollment.belongsTo(User, { foreignKey: 'userId' });
Enrollment.belongsTo(Module, { foreignKey: 'moduleId' });
User.hasMany(Enrollment, { foreignKey: 'userId' });
Module.hasMany(Enrollment, { foreignKey: 'moduleId' });

StudentLesson.belongsTo(User, { foreignKey: 'userId' });
StudentLesson.belongsTo(Lesson, { foreignKey: 'lessonId' });
User.hasMany(StudentLesson, { foreignKey: 'userId' });
Lesson.hasMany(StudentLesson, { foreignKey: 'lessonId' });

module.exports = {
  sequelize,
  User,
  Module,
  Lesson,
  Enrollment,
  StudentLesson,
};
