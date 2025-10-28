const Goal = require('../models/Goal');
const { createNotification } = require('../utils/notificationHelper');
const Activity = require('../models/Activity');

// Helper function to create activity log
const createActivityLog = async (activityData) => {
    try {
        const activity = new Activity(activityData);
        await activity.save();
        return activity;
    } catch (error) {
        console.error('Error creating activity log:', error);
        return null;
    }
};

// Helper function to add income to active goal and handle goal completion
const addIncomeToActiveGoal = async (userId, amount, jobId) => {
    try {
        // Find the active goal
        const activeGoal = await Goal.findOne({ 
            user: userId, 
            isActive: true,
            completed: false
        });
        
        if (!activeGoal) {
            console.log('No active goal found for user:', userId);
            return null;
        }
        
        // Add income to current amount
        activeGoal.currentAmount += amount;
        
        // Check if goal is now completed
        if (activeGoal.currentAmount >= activeGoal.targetAmount) {
            activeGoal.completed = true;
            activeGoal.isActive = false;
            activeGoal.completedAt = new Date();
            
            // First look for priority goals, then fallback to regular order
            const priorityGoal = await Goal.findOne({
                user: userId,
                completed: false,
                isActive: false,
                isPriority: true
            });
            
            const nextGoal = priorityGoal || await Goal.findOne({
                user: userId,
                completed: false,
                isActive: false
            }).sort({ priority: 1 });
            
            if (nextGoal) {
                nextGoal.isActive = true;
                // If it was a priority goal, reset the priority flag
                if (nextGoal.isPriority) {
                    nextGoal.isPriority = false;
                }
                await nextGoal.save();
                
                // Add any excess amount to the next goal
                if (activeGoal.currentAmount > activeGoal.targetAmount) {
                    const excess = activeGoal.currentAmount - activeGoal.targetAmount;
                    nextGoal.currentAmount += excess;
                    // Adjust active goal to exact target amount
                    activeGoal.currentAmount = activeGoal.targetAmount;
                    await nextGoal.save();
                }
                
                await createNotification({
                    recipient: userId,
                    type: 'goal_activated',
                    message: `New active goal: ${nextGoal.description}`
                });
            }
            
            // Send completion notification
            await createNotification({
                recipient: userId,
                type: 'goal_completed',
                message: `Congratulations! You completed your goal: ${activeGoal.description}`
            });
        }
        
        // Calculate progress
        if (activeGoal.targetAmount > 0) {
            activeGoal.progress = (activeGoal.currentAmount / activeGoal.targetAmount) * 100;
        }
        
        await activeGoal.save();
        
        // Create activity log
        await createActivityLog({
            userId,
            type: 'goal_income_added',
            description: `Income added to goal: ${activeGoal.description}`,
            metadata: {
                goalId: activeGoal._id,
                amount,
                jobId,
                newTotal: activeGoal.currentAmount,
                progress: activeGoal.progress,
                completed: activeGoal.completed
            }
        });
        
        return activeGoal;
    } catch (error) {
        console.error('Error adding income to active goal:', error);
        return null;
    }
};

// Export the function so it can be used by other controllers
exports.addIncomeToActiveGoal = addIncomeToActiveGoal;

exports.createGoal = async (req, res) => {
    try {
        const { targetAmount, description, currentAmount = 0 } = req.body;
        
        if (!targetAmount || !description) {
            return res.status(400).json({
                message: "Missing required fields",
                required: ["targetAmount", "description"],
                alert: "Please fill all required fields"
            });
        }

        // Check if there are any active goals for this user
        const activeGoals = await Goal.find({ 
            user: req.user.id, 
            isActive: true 
        });
        
        // If no active goals, make this one active
        const isActive = activeGoals.length === 0;
        
        // Get highest priority to set new goal as next in line
        const highestPriorityGoal = await Goal.findOne({ user: req.user.id })
            .sort({ priority: -1 })
            .limit(1);
            
        const priority = highestPriorityGoal ? highestPriorityGoal.priority + 1 : 1;

        const goal = new Goal({
            user: req.user.id,
            targetAmount,
            description,
            currentAmount,
            progress: (currentAmount / targetAmount) * 100,
            completed: false,
            isActive,
            priority
        });

        await goal.save();

        await createNotification({
            recipient: req.user.id,
            type: 'goal_created',
            message: `New goal created: ${description} (₱${targetAmount})`
        });
        
        await createActivityLog({
            userId: req.user.id,
            userName: `${req.user.firstName} ${req.user.lastName}`,
            type: 'goal_created',
            description: `User created a new goal: ${description}`,
            metadata: {
                targetAmount,
                description,
                isActive
            }
        });

        res.status(201).json({
            message: "Goal created successfully",
            goal,
            alert: "New goal created!"
        });
    } catch (err) {
        console.error('Error creating goal:', err);
        res.status(500).json({ 
            message: "Error creating goal", 
            error: err.message,
            alert: "Failed to create goal"
        });
    }
};

exports.getMyGoals = async (req, res) => {
    try {
        const { status, sortBy = 'priority', order = 'asc' } = req.query;
        
        let query = { user: req.user.id };
        
        // Filter by status if provided (active, pending, completed, all)
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'pending') {
            query.isActive = false;
            query.completed = false;
        } else if (status === 'completed') {
            query.completed = true;
        }
        // If status is not provided or 'all', query remains { user: req.user.id }

        const sortOptions = {};
        sortOptions[sortBy] = order === 'asc' ? 1 : -1;
        
        // For completed goals, always sort by completedAt
        const finalSortOptions = status === 'completed' 
            ? { completedAt: -1 } 
            : sortOptions;

        const goals = await Goal.find(query).sort(finalSortOptions);

        // Calculate statistics
        const totalAmount = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
        const completedGoals = goals.filter(g => g.completed);
        const completedAmount = completedGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
        const activeGoal = goals.find(g => g.isActive);
        
        // Organized goals by category
        const categorizedGoals = {
            active: goals.filter(g => g.isActive),
            pending: goals.filter(g => !g.isActive && !g.completed),
            completed: goals.filter(g => g.completed)
        };

        res.status(200).json({
            goals,
            categorizedGoals,
            summary: {
                totalGoals: goals.length,
                completedGoals: completedGoals.length,
                pendingGoals: goals.filter(g => !g.isActive && !g.completed).length,
                activeGoal: activeGoal ? activeGoal._id : null,
                totalAmount,
                completedAmount,
                completionPercentage: totalAmount > 0 
                    ? Math.round((completedAmount / totalAmount) * 100) 
                    : 0
            },
            alert: `Found ${goals.length} goals`
        });
    } catch (err) {
        console.error('Error fetching goals:', err);
        res.status(500).json({ 
            message: "Error fetching goals", 
            error: err.message,
            alert: "Failed to load your goals"
        });
    }
};

exports.updateGoal = async (req, res) => {
    try {
        const { 
            currentAmount, 
            targetAmount, 
            description, 
            completed, 
            isActive,
            priority,
            isPriority
        } = req.body;
        
        // Find the goal
        let goal = await Goal.findOne({ _id: req.params.id, user: req.user.id });
        
        if (!goal) {
            return res.status(404).json({ 
                message: "Goal not found",
                alert: "No goal found with that ID"
            });
        }
        
        // Calculate progress percentage
        let progress = 0;
        if (targetAmount && targetAmount > 0) {
            const amount = currentAmount !== undefined ? currentAmount : goal.currentAmount;
            progress = (amount / targetAmount) * 100;
        } else if (goal.targetAmount > 0) {
            progress = currentAmount !== undefined 
                ? (currentAmount / goal.targetAmount) * 100
                : goal.progress;
        }
        
        // Check if the goal should be marked as completed
        const shouldComplete = progress >= 100 || completed === true;
        
        // If goal is being marked as completed, deactivate it
        let needsActivationUpdate = false;
        if (shouldComplete && !goal.completed) {
            needsActivationUpdate = true;
        }
        
        // Update the goal
        goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            {
                currentAmount: currentAmount !== undefined ? currentAmount : goal.currentAmount,
                targetAmount: targetAmount !== undefined ? targetAmount : goal.targetAmount,
                description: description || goal.description,
                progress,
                completed: shouldComplete,
                isActive: shouldComplete ? false : (isActive !== undefined ? isActive : goal.isActive),
                priority: priority !== undefined ? priority : goal.priority,
                isPriority: isPriority !== undefined ? isPriority : goal.isPriority,
                completedAt: shouldComplete && !goal.completed ? new Date() : goal.completedAt
            },
            { new: true }
        );

        // Handle notifications and next goal activation
        if (shouldComplete && !goal.completed) {
            // Create completion notification
            await createNotification({
                recipient: req.user.id,
                type: 'goal_completed',
                message: `Congratulations! You completed your goal: ${goal.description}`
            });
            
            await createActivityLog({
                userId: req.user.id,
                userName: `${req.user.firstName} ${req.user.lastName}`,
                type: 'goal_completed',
                description: `User completed a goal: ${goal.description}`,
                metadata: {
                    goalId: goal._id,
                    targetAmount: goal.targetAmount,
                    completedAt: new Date()
                }
            });

            // If this was the active goal, activate the next highest priority pending goal
            if (needsActivationUpdate) {
                const nextGoal = await Goal.findOne({ 
                    user: req.user.id, 
                    completed: false,
                    isActive: false
                }).sort({ priority: 1 });

                if (nextGoal) {
                    nextGoal.isActive = true;
                    await nextGoal.save();
                    
                    await createNotification({
                        recipient: req.user.id,
                        type: 'goal_activated',
                        message: `New active goal: ${nextGoal.description}`
                    });
                }
            }
        }

        // If this goal is being activated, deactivate any other active goals
        if (!goal.completed && isActive === true) {
            await Goal.updateMany(
                { 
                    user: req.user.id, 
                    _id: { $ne: goal._id },
                    isActive: true 
                },
                { isActive: false }
            );
        }

        res.status(200).json({
            message: "Goal updated successfully",
            goal,
            alert: shouldComplete ? "Goal completed!" : "Goal updated"
        });
    } catch (err) {
        console.error('Error updating goal:', err);
        res.status(500).json({ 
            message: "Error updating goal", 
            error: err.message,
            alert: "Failed to update goal"
        });
    }
};

exports.deleteGoal = async (req, res) => {
    try {
        const goal = await Goal.findOne({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!goal) {
            return res.status(404).json({ 
                message: "Goal not found",
                alert: "No goal found with that ID"
            });
        }
        
        // Check if this is the active goal
        const wasActive = goal.isActive;
        
        // Soft delete the goal instead of hard delete
        goal.isDeleted = true;
        goal.deletedAt = new Date();
        goal.isActive = false; // Deactivate if it was active
        await goal.save();
        
        // If the deleted goal was active, activate the next goal
        if (wasActive) {
            const nextGoal = await Goal.findOne({
                user: req.user.id,
                completed: false
            }).sort({ priority: 1 });
            
            if (nextGoal) {
                nextGoal.isActive = true;
                await nextGoal.save();
                
                await createNotification({
                    recipient: req.user.id,
                    type: 'goal_activated',
                    message: `New active goal: ${nextGoal.description}`
                });
            }
        }
        
        // Log the deletion
        await createActivityLog({
            userId: req.user.id,
            userName: `${req.user.firstName} ${req.user.lastName}`,
            type: 'goal_deleted',
            description: `User deleted a goal: ${goal.description}`,
            metadata: {
                description: goal.description,
                targetAmount: goal.targetAmount,
                wasActive,
                wasCompleted: goal.completed
            }
        });

        res.status(200).json({
            message: "Goal deleted successfully",
            deletedGoal: {
                id: goal._id,
                description: goal.description,
                wasActive
            },
            alert: "Goal deleted"
        });
    } catch (err) {
        console.error('Error deleting goal:', err);
        res.status(500).json({ 
            message: "Error deleting goal", 
            error: err.message,
            alert: "Failed to delete goal"
        });
    }
};

// Add income to the active goal
exports.addIncome = async (req, res) => {
    try {
        const { amount, jobId, source } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                message: "Invalid amount",
                required: ["amount"],
                alert: "Please provide a valid amount greater than 0"
            });
        }

        // Process the income addition
        const updatedGoal = await addIncomeToActiveGoal(
            req.user.id, 
            parseFloat(amount),
            jobId || null
        );
        
        if (!updatedGoal) {
            return res.status(404).json({
                message: "No active goal found",
                alert: "You don't have any active financial goals. Create a goal first."
            });
        }
        
        // Check if the goal was completed
        if (updatedGoal.completed) {
            res.status(200).json({
                message: "Income added and goal completed!",
                goal: updatedGoal,
                completed: true,
                alert: `Congratulations! Your goal "${updatedGoal.description}" has been completed!`
            });
        } else {
            res.status(200).json({
                message: "Income added successfully",
                goal: updatedGoal,
                alert: `Income of ₱${amount} added to your goal`
            });
        }
    } catch (err) {
        console.error('Error adding income to goal:', err);
        res.status(500).json({ 
            message: "Error adding income to goal", 
            error: err.message,
            alert: "Failed to add income to goal"
        });
    }
};

// Set a goal as active
exports.setActiveGoal = async (req, res) => {
    try {
        const goalId = req.params.id;
        const { isPriority } = req.body;
        
        console.log('=== setActiveGoal START ===');
        console.log('Goal ID:', goalId);
        console.log('User ID:', req.user?.id);
        console.log('Is Priority:', isPriority);
        
        if (!req.user || !req.user.id) {
            console.error('No user found in request');
            return res.status(401).json({
                message: "Unauthorized",
                alert: "User not authenticated"
            });
        }
        
        // Find the goal
        console.log('Finding goal...');
        const goal = await Goal.findOne({ 
            _id: goalId, 
            user: req.user.id,
            completed: false
        });
        
        console.log('Goal found:', goal ? 'YES' : 'NO');
        
        if (!goal) {
            console.log('Goal not found - checking if deleted...');
            const deletedGoal = await Goal.findOne({ _id: goalId, user: req.user.id }).setOptions({ includeSoftDeleted: true });
            if (deletedGoal && deletedGoal.isDeleted) {
                return res.status(400).json({
                    message: "This goal has been deleted",
                    alert: "Cannot activate a deleted goal"
                });
            }
            return res.status(404).json({
                message: "Goal not found or already completed",
                alert: "The selected goal could not be activated"
            });
        }
        
        // If this is just setting as priority, don't activate it yet
        if (isPriority === true) {
            console.log('Setting goal as priority...');
            goal.isPriority = true;
            await goal.save();
            console.log('Goal saved as priority');
            
            return res.status(200).json({
                message: "Goal set as priority",
                goal: goal.toObject(),
                alert: `"${goal.description}" will be activated when your current active goal is completed`
            });
        }
        
        console.log('Activating goal...');
        
        // Deactivate all other goals
        console.log('Deactivating other goals...');
        const updateResult = await Goal.updateMany(
            { user: req.user.id, isActive: true },
            { isActive: false }
        );
        console.log('Deactivated goals:', updateResult.modifiedCount);
        
        // Set this goal as active
        goal.isActive = true;
        
        // If it was a priority goal, clear the priority flag
        if (goal.isPriority) {
            goal.isPriority = false;
        }
        
        console.log('Saving goal...');
        await goal.save();
        console.log('Goal saved successfully');
        
        // Try to create notification but don't fail if it errors
        try {
            console.log('Creating notification...');
            await createNotification({
                recipient: req.user.id,
                type: 'goal_activated',
                message: `Goal activated: ${goal.description}`
            });
            console.log('Notification created');
        } catch (notifErr) {
            console.error('Error creating notification (non-fatal):', notifErr.message);
        }
        
        console.log('Preparing response...');
        const goalObject = goal.toObject();
        console.log('Sending response...');
        
        res.status(200).json({
            message: "Goal set as active",
            goal: goalObject,
            alert: `"${goal.description}" is now your active goal`
        });
        
        console.log('=== setActiveGoal SUCCESS ===');
        
    } catch (err) {
        console.error('=== setActiveGoal ERROR ===');
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({ 
            message: "Error setting active goal", 
            error: err.message,
            alert: "Failed to set goal as active"
        });
    }
};