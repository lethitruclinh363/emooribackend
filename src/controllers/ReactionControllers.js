const Reaction = require('../model/Reaction');
const Post = require('../model/Post');

const supportedTypes = new Set(['like', 'love', 'care', 'sad']);

const incReaction = async (postId, type, deltaTotal, deltaType) => {
    const typePath = `$reactions.${type}`;
    const updatePipeline = [
        {
            $set: {
                reactionsCount: {
                    $max: [
                        0,
                        {
                            $add: [
                                { $ifNull: ['$reactionsCount', 0] },
                                deltaTotal
                            ]
                        }
                    ]
                },
                [`reactions.${type}`]: {
                    $max: [
                        0,
                        {
                            $add: [
                                { $ifNull: [typePath, 0] },
                                deltaType
                            ]
                        }
                    ]
                }
            }
        }
    ];
    await Post.findByIdAndUpdate(postId, updatePipeline, { updatePipeline: true });
};

const transferReaction = async (postId, oldType, newType) => {
    const oldPath = `$reactions.${oldType}`;
    const newPath = `$reactions.${newType}`;
    const updatePipeline = [
        {
            $set: {
                [`reactions.${oldType}`]: {
                    $max: [
                        0,
                        {
                            $add: [
                                { $ifNull: [oldPath, 0] },
                                -1
                            ]
                        }
                    ]
                },
                [`reactions.${newType}`]: {
                    $max: [
                        0,
                        {
                            $add: [
                                { $ifNull: [newPath, 0] },
                                1
                            ]
                        }
                    ]
                }
            }
        }
    ];
    await Post.findByIdAndUpdate(postId, updatePipeline, { updatePipeline: true });
};

//thả cảm xúc (reaction) vào bài post
exports.toggleReaction = async (req, res) => {
    try {
        const { postId, type } = req.body;
        const userId = req.user.userId;

        if (!supportedTypes.has(type)) {
            return res.status(400).json({ message: 'Invalid reaction type' });
        }

        const existingReaction = await Reaction.findOne({ postId, userId });

        if (existingReaction) {
            if (existingReaction.type === type) {
                // Remove reaction if same type
                await Reaction.deleteOne({ _id: existingReaction._id });
                await incReaction(postId, type, -1, -1);
                return res.status(200).json({ message: 'Reaction removed' });
            } else {
                // Update reaction type
                const oldType = existingReaction.type;
                existingReaction.type = type;
                await existingReaction.save();
                if (supportedTypes.has(oldType)) {
                    await transferReaction(postId, oldType, type);
                } else {
                    await incReaction(postId, type, 0, 1);
                }
                return res.status(200).json(existingReaction);
            }
        } else {
            // Add new reaction
            const newReaction = new Reaction({ postId, userId, type });
            await newReaction.save();
            await incReaction(postId, type, 1, 1);
            res.status(201).json(newReaction);
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getReactionsByPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const reactions = await Reaction.find({ postId }).populate('userId', 'email');
        res.status(200).json(reactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
