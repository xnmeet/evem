import { Evem, EventCoreOn, OnVersionPlanData } from '@evem/cli';

async function main() {
  const evemCli = new Evem();
  EventCoreOn.onVersionPlan((data: OnVersionPlanData[]) => {
    console.log(data);
  });
  await evemCli.execute(['-s', 'version', '--list']);
}

main();
