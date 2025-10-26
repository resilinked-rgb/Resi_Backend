const Job = require('../models/Job');

/**
 * Find jobs matching a user's skills and barangay.
 * @param {User} user - Mongoose User document
 * @param {number} [limit=10] - Maximum number of jobs to return
 * @returns {Promise<Array>} Array of Job documents with match metadata
 */
exports.findMatchingJobs = async (user, limit = 10) => {
    // Only proceed if user has skills
    if (!user.skills || user.skills.length === 0) {
        console.log(`No skills found for user ${user._id}, returning empty job matches`);
        return [];
    }
    
    console.log(`Finding job matches for user ${user._id} with skills: ${user.skills.join(', ')}`);
    
    // Find all open jobs
    const allOpenJobs = await Job.find({
        isOpen: true
    }).populate('postedBy', 'firstName lastName profilePicture');
    
    console.log(`Found ${allOpenJobs.length} open jobs total`);
    
    // Score and filter jobs based on various factors
    const scored = allOpenJobs.map(job => {
        // Calculate skill match score (most important factor)
        const matchingSkills = job.skillsRequired ? 
            job.skillsRequired.filter(skill => user.skills.includes(skill)) : [];
        
        // Calculate skill match percentage
        const skillMatchPercentage = job.skillsRequired && job.skillsRequired.length > 0 ?
            (matchingSkills.length / job.skillsRequired.length) * 100 : 0;
            
        const skillMatchScore = matchingSkills.length;
        
        // Calculate location match (second most important factor)
        const locationMatch = job.barangay === user.barangay;
        const locationMatchScore = locationMatch ? 3 : 0;
        
        // Calculate recency score (newer jobs score higher)
        const jobAge = (Date.now() - new Date(job.datePosted).getTime()) / (1000 * 60 * 60 * 24); // Age in days
        const recencyScore = Math.max(0, 5 - jobAge/2); // Newer jobs score higher (max 5 points)
        
        // Calculate total score with weights
        const totalScore = (skillMatchScore * 10) + locationMatchScore + recencyScore;
        
        return {
            job,
            score: totalScore,
            matchingSkills,
            skillMatchPercentage,
            locationMatch,
            recencyDays: Math.round(jobAge * 10) / 10,
            matchDetails: {
                skillsMatched: matchingSkills.length,
                totalSkillsRequired: job.skillsRequired ? job.skillsRequired.length : 0,
                sameLocation: locationMatch,
                daysAgo: Math.round(jobAge)
            }
        };
    })
    // Filter to only include jobs with at least one matching skill, unless we'd return empty results
    .filter(item => item.matchingSkills.length > 0)
    // Sort by score descending
    .sort((a, b) => b.score - a.score);
    
    console.log(`Found ${scored.length} jobs with at least one skill match`);
    
    // If no exact skill matches but user has skills, find jobs with complementary skills
    if (scored.length === 0 && user.skills && user.skills.length > 0) {
        console.log(`No exact skill matches, finding complementary jobs`);
        
        // Look for jobs with no skill matches but that might be interesting for the user
        const complementaryJobs = allOpenJobs
            .map(job => {
                // Calculate recency score
                const jobAge = (Date.now() - new Date(job.datePosted).getTime()) / (1000 * 60 * 60 * 24);
                const recencyScore = Math.max(0, 5 - jobAge/2);
                
                // Calculate location bonus
                const locationMatchScore = job.barangay === user.barangay ? 3 : 0;
                
                // Simple score based on recency and location
                const totalScore = recencyScore + locationMatchScore;
                
                return {
                    job,
                    score: totalScore,
                    matchingSkills: [],
                    skillMatchPercentage: 0,
                    locationMatch: job.barangay === user.barangay,
                    recencyDays: Math.round(jobAge * 10) / 10
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(5, limit));
            
        console.log(`Found ${complementaryJobs.length} complementary jobs`);
        
        // Add these to our results
        scored.push(...complementaryJobs);
    }
    
    // Return the top matches
    return scored.slice(0, limit).map(s => {
        // Add matching skills to the job object for display
        const jobObj = s.job.toObject();
        jobObj.matchingSkills = s.matchingSkills;
        jobObj.matchScore = s.score;
        jobObj.skillMatchPercentage = s.skillMatchPercentage;
        jobObj.locationMatch = s.locationMatch;
        jobObj.recencyDays = s.recencyDays;
        jobObj.matchDetails = s.matchDetails;
        return jobObj;
    });
};