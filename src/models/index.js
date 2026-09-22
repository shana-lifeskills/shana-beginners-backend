const sequelize = require('../config/database');
const User = require('./User');
const Module = require('./Module');
const Lesson = require('./Lesson');
const Enrollment = require('./Enrollment');
const StudentLesson = require('./StudentLesson');
const StudentModuleProgress = require('./StudentModuleProgress');
const StudentSubmission = require('./StudentSubmission');
const StarLog = require('./StarLog');
const BadgeLog = require('./BadgeLog');
const TrophyLog = require('./TrophyLog');
const ModuleAssignment = require('./ModuleAssignment');

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

// Progress/gamification/assignment tables for the frontend's real (string-id) curriculum.
// These are intentionally separate from the UUID Module/Lesson/Enrollment/StudentLesson
// system above, which models a different, unused content shape.
StudentModuleProgress.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(StudentModuleProgress, { foreignKey: 'userId' });

StudentSubmission.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(StudentSubmission, { foreignKey: 'userId' });

StarLog.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(StarLog, { foreignKey: 'userId' });

BadgeLog.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(BadgeLog, { foreignKey: 'userId' });

TrophyLog.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TrophyLog, { foreignKey: 'userId' });

ModuleAssignment.belongsTo(User, { as: 'student', foreignKey: 'userId' });
ModuleAssignment.belongsTo(User, { as: 'assignedBy', foreignKey: 'assignedByUserId' });
User.hasMany(ModuleAssignment, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Module,
  Lesson,
  Enrollment,
  StudentLesson,
  StudentModuleProgress,
  StudentSubmission,
  StarLog,
  BadgeLog,
  TrophyLog,
  ModuleAssignment,
};
