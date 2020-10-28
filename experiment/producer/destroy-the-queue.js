const argv = require('yargs').argv;
if (!argv.queue || !argv.force) {
    console.log('Provide --queue and --force');
    process.exit();
}
const Queue = require('bee-queue')
const queue = new Queue(argv.queue);

queue.destroy().finally(() => {
        console.log(argv.queue, 'destroyed');
        queue.close();
    }
)