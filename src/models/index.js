const sequelize = require('../config/database');
const User = require('./User');
const CurriculumModule = require('./CurriculumModule');
const CurriculumLesson = require('./CurriculumLesson');
const CurriculumExercise = require('./CurriculumExercise');
const StudentModuleProgress = require('./StudentModuleProgress');
const StudentSubmission = require('./StudentSubmission');
const StarLog = require('./StarLog');
const BadgeLog = require('./BadgeLog');
const TrophyLog = require('./TrophyLog');
const ModuleAssignment = require('./ModuleAssignment');
const Payment = require('./Payment');
const Task = require('./Task');
const TaskSubmission = require('./TaskSubmission');
const PaymentReminderLog = require('./PaymentReminderLog');
const StudentProfile = require('./StudentProfile');

// Curriculum: CurriculumModule is the source of truth; lessons/exercises are derived lookups.
CurriculumModule.belongsTo(User, { as: 'createdBy', foreignKey: 'createdByUserId' });
CurriculumModule.hasMany(CurriculumLesson, { as: 'lessonIndex', foreignKey: 'moduleId' });
CurriculumLesson.belongsTo(CurriculumModule, { foreignKey: 'moduleId' });
CurriculumModule.hasMany(CurriculumExercise, { as: 'exerciseIndex', foreignKey: 'moduleId' });
CurriculumLesson.hasMany(CurriculumExercise, { foreignKey: 'lessonId' });
CurriculumExercise.belongsTo(CurriculumLesson, { foreignKey: 'lessonId' });
CurriculumExercise.belongsTo(CurriculumModule, { foreignKey: 'moduleId' });

// Per-student progress/gamification/assignment state. moduleId/lessonId/exerciseId are
// the curriculum's string ids.
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

Payment.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Payment, { foreignKey: 'userId' });

Task.belongsTo(User, { as: 'createdBy', foreignKey: 'createdByUserId' });
User.hasMany(Task, { foreignKey: 'createdByUserId' });

TaskSubmission.belongsTo(Task, { foreignKey: 'taskId' });
Task.hasMany(TaskSubmission, { foreignKey: 'taskId' });
TaskSubmission.belongsTo(User, { as: 'student', foreignKey: 'studentId' });
TaskSubmission.belongsTo(User, { as: 'reviewedBy', foreignKey: 'reviewedByUserId' });
User.hasMany(TaskSubmission, { foreignKey: 'studentId' });

PaymentReminderLog.belongsTo(User, { as: 'student', foreignKey: 'studentId' });
User.hasMany(PaymentReminderLog, { foreignKey: 'studentId' });

StudentProfile.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(StudentProfile, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  CurriculumModule,
  CurriculumLesson,
  CurriculumExercise,
  StudentModuleProgress,
  StudentSubmission,
  StarLog,
  BadgeLog,
  TrophyLog,
  ModuleAssignment,
  Payment,
  Task,
  TaskSubmission,
  PaymentReminderLog,
  StudentProfile,
};
