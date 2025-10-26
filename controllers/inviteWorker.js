// POST /api/jobs/:id/invite → Invite a worker to a job
exports.inviteWorker = async (req, res) => {
    try {
        const { id } = req.params;
        const { workerId } = req.body;

        // Validate input
        if (!workerId) {
            return res.status(400).json({
                message: "Missing workerId",
                alert: "Worker ID is required"
            });
        }

        // Find the job
        const job = await Job.findById(id).populate('postedBy', 'firstName lastName');
        if (!job) {
            return res.status(404).json({
                message: "Job not found",
                alert: "This job is no longer available"
            });
        }

        // Check authorization - only job poster can invite
        if (job.postedBy._id.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Not authorized",
                alert: "You can only invite workers to your own jobs"
            });
        }

        // Check if job is still open
        if (!job.isOpen) {
            return res.status(400).json({
                message: "Job is closed",
                alert: "This job is no longer accepting applications"
            });
        }

        // Find the worker
        const worker = await User.findById(workerId);
        if (!worker) {
            return res.status(404).json({
                message: "Worker not found",
                alert: "This worker does not exist"
            });
        }

        // Check if worker has right type
        if (worker.userType !== 'employee' && worker.userType !== 'both') {
            return res.status(400).json({
                message: "Invalid worker type",
                alert: "This user cannot be invited to jobs"
            });
        }

        // Check if already invited (based on notifications)
        const alreadyInvited = await mongoose.connection.collection('notifications').findOne({
            recipient: mongoose.Types.ObjectId(workerId),
            type: 'job_invitation',
            relatedJob: mongoose.Types.ObjectId(id)
        });

        if (alreadyInvited) {
            return res.status(200).json({
                message: "Already invited",
                alert: "This worker has already been invited to this job"
            });
        }

        // Create notification for the worker
        await createNotification({
            recipient: workerId,
            type: 'job_invitation',
            message: `You've been invited to apply for "${job.title}" by ${job.postedBy.firstName} ${job.postedBy.lastName}`,
            relatedJob: job._id
        });

        // Send SMS notification if worker has enabled it
        if (worker.notificationPreferences?.sms) {
            await sendSMS(
                workerId,
                `Job invitation: "${job.title}" (₱${job.price}) in ${job.barangay}. Check your notifications to apply.`
            );
        }

        res.status(200).json({
            message: "Invitation sent successfully",
            alert: `Invitation sent to ${worker.firstName} ${worker.lastName}`
        });
    } catch (err) {
        console.error('Error inviting worker:', err);
        res.status(500).json({
            message: "Error inviting worker",
            error: err.message,
            alert: "Failed to send invitation"
        });
    }
};