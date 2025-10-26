const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const auth = require('../middleware/auth');

// Goals CRUD
router.post('/', auth.verify, goalController.createGoal);
router.get('/', auth.verify, goalController.getMyGoals);
router.put('/:id', auth.verify, goalController.updateGoal);
router.delete('/:id', auth.verify, goalController.deleteGoal);

// Additional goal management endpoints
router.post('/income', auth.verify, goalController.addIncome);
router.post('/:id/activate', auth.verify, goalController.setActiveGoal);

module.exports = router;