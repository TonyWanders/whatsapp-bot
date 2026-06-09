const { Octokit } = require("@octokit/rest");
const glob = require("glob");
const fs = require("fs");
const path = require("path");

const token = process.argv[2];
if (!token) {
    console.error("Please provide a token as an argument");
    process.exit(1);
}

const octokit = new Octokit({ auth: token });
const owner = "TonyWanders";
const repo = "whatsapp-bot";
const baseDir = "C:\\Users\\USER\\.gemini\\antigravity\\scratch\\nigeria-job-hunter";

async function pushToGitHub() {
    console.log("Getting main branch ref...");
    let refData;
    try {
        const res = await octokit.rest.git.getRef({ owner, repo, ref: "heads/main" });
        refData = res.data;
    } catch (e) {
        console.log("main not found, trying master...");
        const res = await octokit.rest.git.getRef({ owner, repo, ref: "heads/master" });
        refData = res.data;
    }

    const commitSha = refData.object.sha;
    
    console.log("Getting commit data...");
    const { data: commitData } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: commitSha });
    const baseTreeSha = commitData.tree.sha;

    console.log("Reading files...");
    const files = glob.sync("**/*", { 
        cwd: baseDir, 
        nodir: true,
        ignore: ['node_modules/**', 'frontend/node_modules/**', 'backend/node_modules/**', '.git/**', '.env', 'backend/.wwebjs_auth/**', 'backend/.wwebjs_cache/**', '**/*.db', '**/*.db-*', '**/*.pdf', '**/*.png']
    });
    
    const tree = [];
    
    for (const file of files) {
        const filePath = path.join(baseDir, file);
        const content = fs.readFileSync(filePath);
        const githubPath = file.split(path.sep).join('/'); // Ensure posix path
        
        console.log(`Uploading ${githubPath}...`);
        
        let blobData;
        let retries = 3;
        while (retries > 0) {
            try {
                const res = await octokit.rest.git.createBlob({
                    owner,
                    repo,
                    content: content.toString('base64'),
                    encoding: "base64",
                    request: { timeout: 30000 } // 30s timeout
                });
                blobData = res.data;
                break; // success
            } catch (err) {
                retries--;
                console.log(`Failed to upload ${githubPath}, retries left: ${retries}. Error: ${err.message}`);
                if (retries === 0) throw err;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        tree.push({
            path: githubPath,
            mode: "100644",
            type: "blob",
            sha: blobData.sha
        });
        
        // Small delay to prevent hitting rate limits
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("Creating new tree...");
    const { data: treeData } = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: tree
    });

    console.log("Creating commit...");
    const { data: newCommitData } = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: "Update Nigeria Job Hunter Web App",
        tree: treeData.sha,
        parents: [commitSha]
    });

    console.log("Updating ref...");
    const refPath = refData.ref.replace('refs/', '');
    await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: refPath,
        sha: newCommitData.sha,
        force: true
    });
    
    console.log("Successfully pushed!");
}

pushToGitHub().catch(err => {
    console.error("Error:", err);
});
